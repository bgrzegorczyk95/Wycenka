import type { OfferDetail, OfferListItem, PriceListResponse, SendResponse } from '@wycenka/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Env } from '../src/env';
import { processOffer } from '../src/jobs/processOffer';
import { Client, createTestEnv, onboardGlazier } from './setup';

let env: Env;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ env, dispose } = await createTestEnv());
});
afterAll(async () => dispose());

let seq = 300;
const glazier = () => onboardGlazier(env, `+48600000${seq++}`, '600 000 000');
const plain = (s: string) => s.replaceAll(String.fromCharCode(160), ' ');
const BROWSER_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

async function createOffer(client: Client, clientName = 'Anna Kowalska') {
  const created = await client.json<OfferDetail>('POST', '/api/offers', {
    clientUuid: crypto.randomUUID(),
    client: { name: clientName, phone: '600 111 222', address: 'ul. Puławska 1, Mokotów' },
  });
  expect(created.status).toBe(201);
  return created.body;
}

/** Runs the mock AI pipeline like the queue consumer would. */
async function processed(client: Client, id: string): Promise<OfferDetail> {
  const started = await client.json<OfferDetail>('POST', `/api/offers/${id}/process`, {});
  expect(started.status).toBe(202);
  expect(started.body.status).toBe('processing');
  await processOffer(env, id);
  return (await client.json<OfferDetail>('GET', `/api/offers/${id}`)).body;
}

async function goldenReadyToSend(client: Client) {
  const offer = await createOffer(client);
  await processed(client, offer.id);
  let detail = (
    await client.json<OfferDetail>('POST', `/api/offers/${offer.id}/answers`, { answers: { q1: 'Tak' } })
  ).body;
  const brodzik = detail.items.find((i) => i.missingPrice)!;
  detail = (
    await client.json<OfferDetail>(
      'PATCH',
      `/api/offers/${offer.id}/items/${encodeURIComponent(brodzik.key)}`,
      {
        unitPriceGr: 90000,
        saveToPriceList: true,
      },
    )
  ).body;
  return detail;
}

describe('offer flow (golden example through the API)', () => {
  it('mock AI prepares the bathroom offer from the fixture with the contractor’s prices', async () => {
    const client = await glazier();
    const offer = await createOffer(client);
    expect(offer).toMatchObject({
      status: 'draft',
      title: 'Nowa oferta',
      items: [],
      validUntil: expect.any(String),
    });

    const detail = await processed(client, offer.id);
    expect(detail.status).toBe('ready');
    expect(detail.title).toBe('Remont łazienki');
    expect(detail.processingStep).toBe('priced');
    expect(detail.transcript).toContain('skuwamy stare płytki');
    expect(detail.questions).toEqual([
      expect.objectContaining({ id: 'q1', text: 'Czy płytki także na podłodze?', answer: null }),
    ]);
    expect(detail.items.map((i) => [i.name, i.qtyMilli, i.unitPriceGr])).toEqual([
      ['Skucie płytek (ściany + podłoga)', 30400, 4500],
      ['Płytki 60×120 – ściany', 24400, 18000],
      ['Montaż stelaża podtynkowego WC', 1000, 65000],
      ['Montaż brodzika walk-in', 1000, null],
    ]);
    expect(detail.warnings).toEqual([]);
    expect(detail.totals.canSend).toBe(false);
  });

  it('answer → floor tiles; brodzik price saved to the price list → 8 931,60 zł', async () => {
    const client = await glazier();
    const detail = await goldenReadyToSend(client);
    expect(detail.items.map((i) => i.name)).toEqual([
      'Skucie płytek (ściany + podłoga)',
      'Płytki 60×120 – ściany',
      'Płytki – podłoga',
      'Montaż stelaża podtynkowego WC',
      'Montaż brodzika walk-in',
    ]);
    expect(detail.items[2]).toMatchObject({ sourceKind: 'ai_answer', sourceQuestionId: 'q1' });
    expect(detail.questions).toEqual([]);
    expect(detail.totals).toMatchObject({
      netGr: 827000,
      vatGr: 66160,
      grossGr: 893160,
      missingPriceCount: 0,
      canSend: true,
    });

    // „Zapisz w cenniku” → the price list shows it as new, with the banner
    const list = (await client.json<PriceListResponse>('GET', '/api/price-list')).body;
    expect(list.items.find((i) => i.name === 'Montaż brodzika walk-in')).toMatchObject({
      priceGr: 90000,
      unit: 'kpl',
      category: 'Montaż',
      isNew: true,
      source: 'offer',
    });
    expect(list.recentFromOffers[0]).toMatchObject({
      offerLabel: 'Remont łazienki – A. Kowalska',
      priceGr: 90000,
    });

    // List of offers
    const offers = (await client.json<OfferListItem[]>('GET', '/api/offers')).body;
    expect(offers[0]).toMatchObject({
      title: 'Remont łazienki',
      clientName: 'Anna Kowalska',
      grossGr: 893160,
      status: 'ready',
    });
  });

  it('price list changes do not change an existing offer until „Odśwież ceny z cennika”', async () => {
    const client = await glazier();
    const detail = await goldenReadyToSend(client);
    const list = (await client.json<PriceListResponse>('GET', '/api/price-list')).body;
    const skucie = list.items.find((i) => i.name === 'Skucie płytek')!;
    await client.json('PATCH', `/api/price-list/items/${skucie.id}`, { priceGr: 5000 });

    const same = (await client.json<OfferDetail>('GET', `/api/offers/${detail.id}`)).body;
    expect(same.totals.grossGr).toBe(893160);
    const refreshed = (await client.json<OfferDetail>('POST', `/api/offers/${detail.id}/refresh-prices`, {}))
      .body;
    expect(refreshed.items[0]!.unitPriceGr).toBe(5000);
  });

  it('blocks sending with missing prices, then sends with a number and shows the client page', async () => {
    const client = await glazier();
    const offer = await createOffer(client);
    await processed(client, offer.id);
    const blocked = await client.json<{ error: { code: string; message: string } }>(
      'POST',
      `/api/offers/${offer.id}/send`,
      {
        channel: 'sms',
      },
    );
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe('missing_prices');

    // Not visible to the client before sending (rule 4)
    const link = (await client.json<OfferDetail>('GET', `/api/offers/${offer.id}`)).body.link;
    const token = link.split('/o/')[1]!;
    expect(token).toMatch(/^[0-9A-Za-z]{16}$/);
    expect((await new Client(env).request('GET', `/o/${token}`)).status).toBe(404);

    // Preview for the contractor works before sending
    const preview = await client.request('GET', `/api/offers/${offer.id}/preview`);
    expect(preview.status).toBe(200);
    expect(await preview.text()).toContain('Podgląd – klient zobaczy ofertę dopiero po wysłaniu.');
  });

  it('send → client opens → accepts (evidence stored) → contractor sees statuses', async () => {
    const client = await glazier();
    const ready = await goldenReadyToSend(client);
    await client.json('PATCH', `/api/offers/${ready.id}`, { startText: 'od 2 grudnia 2026' });

    const sent = await client.json<SendResponse>('POST', `/api/offers/${ready.id}/send`, { channel: 'sms' });
    expect(sent.status).toBe(200);
    expect(sent.body.offer.status).toBe('sent');
    expect(sent.body.offer.number).toMatch(/^\d{4}\/\d{2}\/001$/);
    const token = sent.body.link.split('/o/')[1]!;

    // Second offer of the month gets 002
    const second = await goldenReadyToSend(client);
    const sent2 = await client.json<SendResponse>('POST', `/api/offers/${second.id}/send`, {
      channel: 'link',
    });
    expect(sent2.body.offer.number).toMatch(/\/002$/);

    // Read-only after sending
    const locked = await client.json('PATCH', `/api/offers/${ready.id}`, { title: 'Inny tytuł' });
    expect(locked.status).toBe(409);

    // Client page (no session)
    const visitor = new Client(env);
    const page = await visitor.request('GET', `/o/${token}`, undefined, { 'User-Agent': BROWSER_UA });
    expect(page.status).toBe(200);
    expect(page.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(page.headers.get('referrer-policy')).toBe('no-referrer');
    expect(page.headers.get('content-security-policy')).toContain("script-src 'nonce-");
    const html = plain(await page.text());
    expect(html).toContain('<title>Oferta: Remont łazienki – Usługi Glazurnicze Nowak</title>');
    expect(html).toContain('8 931,60 zł');
    expect(html).toContain('VAT 8%');
    expect(html).toContain('Montaż brodzika walk-in');
    expect(html).toContain('od 2 grudnia 2026');
    expect(html).toContain('30% przy rozpoczęciu');
    expect(html).toContain('po stronie klienta');
    expect(html).toContain('Oferta przygotowana w aplikacji Wycenka'); // free plan footer
    expect(html).toContain('href="tel:+48600000000"');

    // Link preview bots do not mark it as opened; a real browser does
    await visitor.request('POST', `/o/${token}/opened`, undefined, { 'User-Agent': 'WhatsApp/2.23.20.0' });
    expect((await client.json<OfferDetail>('GET', `/api/offers/${ready.id}`)).body.status).toBe('sent');
    await visitor.request('POST', `/o/${token}/opened`, undefined, { 'User-Agent': BROWSER_UA });
    let detail = (await client.json<OfferDetail>('GET', `/api/offers/${ready.id}`)).body;
    expect(detail.status).toBe('opened');
    expect(detail.openedAt).not.toBeNull();

    // Two-step acceptance, works without JS
    const confirm = plain(await (await visitor.request('GET', `/o/${token}?potwierdz=1`)).text());
    expect(confirm).toContain('Akceptujesz ofertę na 8 931,60 zł?');
    const accepted = await visitor.request('POST', `/o/${token}/accept`, undefined, {
      'User-Agent': BROWSER_UA,
      'CF-Connecting-IP': '203.0.113.7',
    });
    expect(accepted.status).toBe(303);
    const thanks = plain(await (await visitor.request('GET', `/o/${token}`)).text());
    expect(thanks).toContain('Dziękujemy, oferta zaakceptowana');
    expect(thanks).toContain('Zaakceptowano');

    detail = (await client.json<OfferDetail>('GET', `/api/offers/${ready.id}`)).body;
    expect(detail.status).toBe('accepted');
    expect(detail.events.map((e) => e.type)).toEqual([
      'created',
      'processing_started',
      'processed',
      'sent',
      'opened',
      'accepted',
    ]);
    const evidence = await env.DB.prepare(
      "select payload from offer_events where offer_id = ? and type = 'accepted'",
    )
      .bind(ready.id)
      .first<{ payload: string }>();
    const payload = JSON.parse(evidence!.payload) as Record<string, unknown>;
    expect(payload).toMatchObject({ grossGr: 893160, userAgent: BROWSER_UA });
    expect(payload.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(payload)).not.toContain('203.0.113.7');

    // Accepted is final
    expect((await client.request('POST', `/api/offers/${ready.id}/send`, { channel: 'sms' })).status).toBe(
      409,
    );
  });

  it('client questions: event, honeypot, 5 per day', async () => {
    const client = await glazier();
    const ready = await goldenReadyToSend(client);
    const token = (
      await client.json<SendResponse>('POST', `/api/offers/${ready.id}/send`, { channel: 'whatsapp' })
    ).body.link.split('/o/')[1]!;
    const visitor = new Client(env);
    const form = (body: Record<string, string>) =>
      visitor.request('POST', `/o/${token}/pytanie`, new URLSearchParams(body).toString(), {
        'Content-Type': 'application/x-www-form-urlencoded',
      });

    // Chips prefill the question without JS
    expect(
      await (
        await visitor.request('GET', `/o/${token}/pytanie?q=Kiedy%20mo%C5%BCecie%20zacz%C4%85%C4%87%3F`)
      ).text(),
    ).toContain('Kiedy możecie zacząć?</textarea>');
    expect((await form({ text: '' })).status).toBe(400);
    expect((await form({ text: 'Spam', website: 'http://spam' })).status).toBe(303);
    for (let i = 0; i < 5; i++)
      expect((await form({ text: `Pytanie ${i}`, phone: '600 111 222' })).status).toBe(303);
    const sixth = await form({ text: 'Szóste' });
    expect(sixth.status).toBe(400);
    expect(await sixth.text()).toContain('Wysłano już kilka pytań');

    const detail = (await client.json<OfferDetail>('GET', `/api/offers/${ready.id}`)).body;
    const questions = detail.events.filter((e) => e.type === 'question');
    expect(questions).toHaveLength(5);
    expect(questions[0]!.payload).toEqual({ text: 'Pytanie 0', phone: '600 111 222' });
    expect(detail.status).toBe('sent'); // a question does not change the status
  });

  it('manual offer: add items from the price list and own ones, edit, delete', async () => {
    const client = await glazier();
    const offer = await createOffer(client, 'Jan Nowak');
    const list = (await client.json<PriceListResponse>('GET', '/api/price-list')).body;
    const stelaz = list.items.find((i) => i.name === 'Stelaż podtynkowy WC')!;

    let d = (
      await client.json<OfferDetail>('POST', `/api/offers/${offer.id}/items`, {
        priceListItemId: stelaz.id,
        name: 'Montaż stelaża podtynkowego WC',
        unit: 'kpl',
        qtyMilli: 2000,
      })
    ).body;
    expect(d.items[0]).toMatchObject({ unitPriceGr: 65000, valueGr: 130000, sourceKind: 'manual' });

    d = (
      await client.json<OfferDetail>('POST', `/api/offers/${offer.id}/items`, {
        priceListItemId: null,
        name: 'Wywóz gruzu',
        unit: 'kpl',
        qtyMilli: 1000,
        unitPriceGr: 30000,
      })
    ).body;
    expect(d.totals.netGr).toBe(160000);

    const key = encodeURIComponent(d.items[1]!.key);
    d = (
      await client.json<OfferDetail>('PATCH', `/api/offers/${offer.id}/items/${key}`, { unitPriceGr: 35000 })
    ).body;
    expect(d.totals.netGr).toBe(165000);
    d = (await client.json<OfferDetail>('DELETE', `/api/offers/${offer.id}/items/${key}`)).body;
    expect(d.items).toHaveLength(1);

    d = (
      await client.json<OfferDetail>('PATCH', `/api/offers/${offer.id}`, {
        title: 'Stelaże',
        vatBps: null,
        discountBps: 1000,
      })
    ).body;
    expect(d.totals).toMatchObject({ netGr: 117000, vatGr: 0, grossGr: 117000 });
    expect(d.title).toBe('Stelaże');
  });

  it('is idempotent per clientUuid and isolated per company', async () => {
    const a = await glazier();
    const b = await glazier();
    const clientUuid = crypto.randomUUID();
    const body = { clientUuid, client: { name: 'Anna Kowalska' } };
    const first = await a.json<OfferDetail>('POST', '/api/offers', body);
    const again = await a.json<OfferDetail>('POST', '/api/offers', body);
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(first.body.id);
    expect((await b.request('GET', `/api/offers/${first.body.id}`)).status).toBe(404);
    expect((await b.request('POST', `/api/offers/${first.body.id}/send`, { channel: 'sms' })).status).toBe(
      404,
    );
    expect((await b.json<OfferListItem[]>('GET', '/api/offers')).body).toEqual([]);
  });
});
