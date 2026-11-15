import type { OnboardingRatesResponse, PriceListEntry, PriceListResponse } from '@wycenka/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Env } from '../src/env';
import { Client, createTestEnv, onboardGlazier } from './setup';

let env: Env;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ env, dispose } = await createTestEnv());
});
afterAll(async () => dispose());

let phoneSeq = 100;
const onboardedGlazier = () => onboardGlazier(env, `+48600000${phoneSeq++}`);

describe('price list API (M3)', () => {
  it('lists items in price-list order with rules from the Cennik mockup', async () => {
    const client = await onboardedGlazier();
    const { status, body } = await client.json<PriceListResponse>('GET', '/api/price-list');
    expect(status).toBe(200);
    expect(body.trades).toEqual([{ trade: 'glazurnik', label: 'Glazurnik' }]);
    expect(body.items.map((i) => [i.name, i.priceGr, i.unit, i.category])).toEqual([
      ['Skucie płytek', 4500, 'm2', 'Przygotowanie'],
      ['Gruntowanie', 800, 'm2', 'Przygotowanie'],
      ['Hydroizolacja', 3500, 'm2', 'Przygotowanie'],
      ['Płytki standard – ściany', 14000, 'm2', 'Płytki'],
      ['Płytki 60×120 – ściany', 18000, 'm2', 'Płytki'],
      ['Płytki – podłoga', 16000, 'm2', 'Płytki'],
      ['Fugowanie epoksydowe', 6000, 'm2', 'Płytki'],
      ['Listwa / narożnik', 4000, 'mb', 'Płytki'],
      ['Silikonowanie', 1500, 'mb', 'Płytki'],
      ['Stelaż podtynkowy WC', 65000, 'kpl', 'Montaż'],
    ]);
    expect(body.rules.map((r) => [r.label, r.bps, r.amountGr, r.thresholdMilli])).toEqual([
      ['Mozaika i drobne formaty', 2000, null, null],
      ['Wysokość powyżej 3 m', 1500, null, 3000],
      ['Minimalna kwota zlecenia', null, 50000, null],
      ['Dojazd poza miasto', null, 10000, null],
      ['Materiał wykonawcy – narzut', 1000, null, null],
    ]);
    expect(body.recentFromOffers).toEqual([]);
  });

  it('adds, edits and archives items', async () => {
    const client = await onboardedGlazier();
    const created = await client.json<PriceListEntry>('POST', '/api/price-list/items', {
      name: 'Brodzik walk-in',
      offerName: 'Montaż brodzika walk-in',
      category: 'Montaż',
      unit: 'kpl',
      priceGr: 90000,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      name: 'Brodzik walk-in',
      measure: 'count',
      source: 'manual',
      isNew: false,
    });

    const edited = await client.json<PriceListEntry>('PATCH', `/api/price-list/items/${created.body.id}`, {
      priceGr: 95000,
    });
    expect(edited.body).toMatchObject({
      priceGr: 95000,
      name: 'Brodzik walk-in',
      offerName: 'Montaż brodzika walk-in',
    });

    let list = (await client.json<PriceListResponse>('GET', '/api/price-list')).body;
    expect(list.items.at(-1)).toMatchObject({ name: 'Brodzik walk-in', priceGr: 95000 });

    expect((await client.request('DELETE', `/api/price-list/items/${created.body.id}`)).status).toBe(204);
    list = (await client.json<PriceListResponse>('GET', '/api/price-list')).body;
    expect(list.items.map((i) => i.name)).not.toContain('Brodzik walk-in');
    // Archived, not deleted (old offers may reference it)
    const row = await env.DB.prepare('select archived_at from price_list_items where id = ?')
      .bind(created.body.id)
      .first<{ archived_at: number | null }>();
    expect(row!.archived_at).not.toBeNull();
    expect(
      (await client.request('PATCH', `/api/price-list/items/${created.body.id}`, { priceGr: 1 })).status,
    ).toBe(404);
  });

  it('validates items with Polish messages', async () => {
    const client = await onboardedGlazier();
    const bad = await client.json<{ error: { message: string } }>('POST', '/api/price-list/items', {
      name: 'X',
      category: 'Montaż',
      unit: 'kpl',
      priceGr: 100,
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error.message).toBe('Wpisz nazwę pozycji.');
    const negative = await client.json<{ error: { message: string } }>('POST', '/api/price-list/items', {
      name: 'Coś',
      category: 'Montaż',
      unit: 'kpl',
      priceGr: -1,
    });
    expect(negative.body.error.message).toBe('Cena nie może być ujemna.');
  });

  it('edits rules („Dopłaty i zasady”)', async () => {
    const client = await onboardedGlazier();
    const r = await client.json<PriceListResponse>('PUT', '/api/price-list/rules/height_surcharge', {
      enabled: true,
      bps: 2000,
      thresholdMilli: 3500,
      amountGr: 999, // ignored for a percentage rule
    });
    expect(r.body.rules.find((x) => x.kind === 'height_surcharge')).toEqual({
      kind: 'height_surcharge',
      label: 'Wysokość powyżej 3 m',
      bps: 2000,
      amountGr: null,
      thresholdMilli: 3500,
      enabled: true,
    });
    const off = await client.json<PriceListResponse>('PUT', '/api/price-list/rules/travel_fee', {
      enabled: false,
      amountGr: null,
    });
    expect(off.body.rules.find((x) => x.kind === 'travel_fee')!.enabled).toBe(false);

    const empty = await client.json('PUT', '/api/price-list/rules/min_order', {
      enabled: true,
      amountGr: null,
    });
    expect(empty.status).toBe(400);
    expect((await client.request('PUT', '/api/price-list/rules/nope', { enabled: true })).status).toBe(404);
  });

  it('adds the template of another trade, skipping work already in the price list', async () => {
    const client = await onboardedGlazier();
    const tpl = await client.json<OnboardingRatesResponse>(
      'GET',
      '/api/price-list/templates/ekipa_remontowa',
    );
    // „Skucie płytek” and „Płytki – podłoga” are already in the glazier price list
    expect(tpl.body.items.map((i) => i.name)).not.toContain('Skucie płytek');
    expect(tpl.body.items.map((i) => i.name)).not.toContain('Płytki – podłoga');
    expect(tpl.body.items.every((i) => i.priceGr === null)).toBe(true);

    const added = await client.json<PriceListResponse>('POST', '/api/price-list/templates', {
      trade: 'ekipa_remontowa',
      items: [
        { templateKey: 'ekipa_remontowa.wywoz_gruzu', priceGr: 40000 },
        { templateKey: 'ekipa_remontowa.tynkowanie', priceGr: null },
      ],
    });
    expect(added.body.trades.map((t) => t.label)).toEqual(['Glazurnik', 'Ekipa remontowa']);
    expect(added.body.items.at(-1)).toMatchObject({
      name: 'Wywóz gruzu',
      priceGr: 40000,
      category: 'Rozbiórki',
    });
    expect(added.body.items.map((i) => i.name)).not.toContain('Tynkowanie');
    expect((await client.request('GET', '/api/price-list/templates/astronauta')).status).toBe(404);
  });

  it('exports the price list to Excel', async () => {
    const client = await onboardedGlazier();
    const res = await client.request('GET', '/api/price-list/export.xlsx');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers.get('content-disposition')).toContain(
      "filename*=UTF-8''Cennik-Us%C5%82ugi-Glazurnicze-Nowak.xlsx",
    );
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]); // ZIP
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('<t>Stelaż podtynkowy WC</t>');
    expect(text).toContain('<t>Montaż stelaża podtynkowego WC</t>');
    expect(text).toContain('<v>650.00</v>');
  });

  it('never exposes or changes another company’s items', async () => {
    const a = await onboardedGlazier();
    const b = await onboardedGlazier();
    const itemOfA = (await a.json<PriceListResponse>('GET', '/api/price-list')).body.items[0]!;
    expect((await b.request('PATCH', `/api/price-list/items/${itemOfA.id}`, { priceGr: 1 })).status).toBe(
      404,
    );
    expect((await b.request('DELETE', `/api/price-list/items/${itemOfA.id}`)).status).toBe(404);
    const stillA = (await a.json<PriceListResponse>('GET', '/api/price-list')).body.items[0]!;
    expect(stillA.priceGr).toBe(itemOfA.priceGr);
  });

  it('marks items added from an offer as new and shows the „Dodano z oferty” banner', async () => {
    const client = await onboardedGlazier();
    const me = await client.json<{ company: { id: string }; user: { id: string } }>('GET', '/api/me');
    const companyId = me.body.company.id;
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare(
        "insert into clients (id, company_id, name, created_at) values ('cl1', ?, 'Anna Kowalska', ?)",
      ).bind(companyId, now),
      env.DB.prepare(
        `insert into offers (id, company_id, client_id, created_by_user_id, client_uuid, title, status, created_at, updated_at)
         values ('of1', ?, 'cl1', ?, 'u1', 'Łazienka', 'ready', ?, ?)`,
      ).bind(companyId, me.body.user.id, now, now),
      env.DB.prepare(
        `insert into price_list_items (id, company_id, category, name, offer_name, unit, price_gr, measure, source, source_offer_id, sort_order, created_at, updated_at)
         values ('pi1', ?, 'Montaż', 'Brodzik walk-in', 'Montaż brodzika walk-in', 'kpl', 90000, 'count', 'offer', 'of1', 99, ?, ?)`,
      ).bind(companyId, now, now),
    ]);
    const list = (await client.json<PriceListResponse>('GET', '/api/price-list')).body;
    expect(list.items.at(-1)).toMatchObject({ name: 'Brodzik walk-in', isNew: true });
    expect(list.recentFromOffers).toEqual([
      {
        itemId: 'pi1',
        name: 'Montaż brodzika walk-in',
        unit: 'kpl',
        priceGr: 90000,
        offerLabel: 'Łazienka – A. Kowalska',
      },
    ]);
  });

  it('requires a session', async () => {
    expect((await new Client(env).request('GET', '/api/price-list')).status).toBe(401);
  });
});
