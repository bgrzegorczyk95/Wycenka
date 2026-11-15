import {
  AddOfferItemInput,
  AnswersInput,
  CreateOfferInput,
  GeometryInput,
  OfferItemPatch,
  OfferPatch,
  SendInput,
  addDays,
  isSentStatus,
  normalizeForQuote,
  warsawDate,
  warsawMonth,
  type OfferItemOverride,
  type SendResponse,
} from '@wycenka/core';
import { clients, companies, offerEvents, offers, priceListItems } from '@wycenka/db';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { Hono, type Context } from 'hono';
import { mockExtraction } from '../ai/mock';
import { buildView, isExpired, newNonce, renderOffer, securityHeaders } from '../client-page/routes';
import { fail, parseBody, type AppEnv } from '../http';
import {
  DEFAULT_OFFER_TITLE,
  computeOffer,
  emptyExtraction,
  loadOffer,
  persistResult,
  takeSnapshot,
  toDetail,
  toListItem,
  newToken,
  type OfferRow,
} from '../offers/state';
import { getCompanyRow } from './me';

type Ctx = Context<AppEnv>;

const NOT_FOUND = 'Nie ma takiej oferty.';
const LOCKED = 'Oferta została już wysłana – w tej wersji nie można jej zmieniać.';

/** Applies a change to the offer state, re-runs the pricing engine and stores the result. */
async function update(c: Ctx, row: OfferRow, change: Partial<OfferRow>, extra: BatchItem<'sqlite'>[] = []) {
  const { db } = c.var;
  const now = Date.now();
  const next: OfferRow = { ...row, ...change, updatedAt: now };
  const result = computeOffer(next);
  await db.batch([
    db
      .update(offers)
      .set({ ...change, updatedAt: now })
      .where(and(eq(offers.id, row.id), eq(offers.companyId, row.companyId))),
    ...persistResult(db, next, result, now),
    ...extra,
  ] as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
  return c.json(await toDetail(db, next, c.env.APP_URL));
}

/** Loads an offer that can still be edited (not sent yet). */
async function editable(c: Ctx): Promise<OfferRow | Response> {
  const row = await loadOffer(c.var.db, c.var.companyId, c.req.param('id')!);
  if (!row) return fail(c, 404, 'not_found', NOT_FOUND);
  if (isSentStatus(row.status)) return fail(c, 409, 'already_sent', LOCKED);
  if (row.status === 'processing')
    return fail(c, 409, 'processing', 'AI jeszcze układa ofertę. Poczekaj chwilę.');
  return row;
}

const event = (
  row: OfferRow,
  type: (typeof offerEvents.$inferInsert)['type'],
  extra: Partial<typeof offerEvents.$inferInsert> = {},
) => ({
  id: crypto.randomUUID(),
  offerId: row.id,
  companyId: row.companyId,
  type,
  createdAt: Date.now(),
  ...extra,
});

export const offerRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const { db, companyId } = c.var;
    const status = c.req.query('status');
    const q = normalizeForQuote(c.req.query('q') ?? '');
    const query = db
      .select({ offer: offers, client: clients })
      .from(offers)
      .leftJoin(clients, and(eq(clients.id, offers.clientId), eq(clients.companyId, offers.companyId)))
      .where(
        and(
          eq(offers.companyId, companyId),
          status ? eq(offers.status, status as OfferRow['status']) : undefined,
        ),
      )
      .orderBy(desc(offers.updatedAt));
    // Search is done in code (Polish diacritics), so it has to see all offers, not the latest 200.
    const rows = await (q ? query.all() : query.limit(200).all());
    const list = rows
      .map((r) => toListItem(r.offer, r.client))
      .filter(
        (o) =>
          !q || normalizeForQuote(`${o.title} ${o.clientName ?? ''} ${o.clientAddress ?? ''}`).includes(q),
      );
    return c.json(list);
  })

  .post('/', async (c) => {
    const parsed = await parseBody(c, CreateOfferInput);
    if (!parsed.ok) return parsed.response;
    const { db, companyId, user } = c.var;
    const input = parsed.data;

    // Idempotent per clientUuid (offline queue may retry).
    const existing = await db
      .select()
      .from(offers)
      .where(and(eq(offers.companyId, companyId), eq(offers.clientUuid, input.clientUuid)))
      .get();
    if (existing) return c.json(await toDetail(db, existing, c.env.APP_URL), 200);

    const company = await getCompanyRow(db, companyId);
    const now = Date.now();
    const clientId = crypto.randomUUID();
    const title = input.title ?? DEFAULT_OFFER_TITLE;
    const row = {
      id: crypto.randomUUID(),
      companyId,
      clientId,
      createdByUserId: user.id,
      clientUuid: input.clientUuid,
      title,
      status: 'draft' as const,
      token: newToken(),
      aiExtraction: emptyExtraction(title),
      priceSnapshot: await takeSnapshot(db, companyId),
      validUntil: addDays(warsawDate(now), company.defaultValidityDays),
      depositBps: company.defaultDepositBps,
      vatBps: company.defaultVatBps,
      createdAt: now,
      updatedAt: now,
    };
    await db.batch([
      db.insert(clients).values({
        id: clientId,
        companyId,
        name: input.client.name,
        phone: input.client.phone ?? null,
        address: input.client.address ?? null,
        createdAt: now,
      }),
      db.insert(offers).values(row),
      db.insert(offerEvents).values(event(row as OfferRow, 'created')),
    ]);
    const created = (await loadOffer(db, companyId, row.id))!;
    return c.json(await toDetail(db, created, c.env.APP_URL), 201);
  })

  .get('/:id', async (c) => {
    const row = await loadOffer(c.var.db, c.var.companyId, c.req.param('id'));
    if (!row) return fail(c, 404, 'not_found', NOT_FOUND);
    return c.json(await toDetail(c.var.db, row, c.env.APP_URL));
  })

  /** „Otwórz PDF” / „Zobacz jak klient”: the client page rendered for the contractor, before or after sending. */
  .get('/:id/preview', async (c) => {
    const row = await loadOffer(c.var.db, c.var.companyId, c.req.param('id'));
    if (!row) return fail(c, 404, 'not_found', NOT_FOUND);
    const company = await getCompanyRow(c.var.db, c.var.companyId);
    const nonce = newNonce();
    securityHeaders(c, nonce, { framable: true });
    return renderOffer(
      c,
      buildView(row, company, '/api/company/logo'),
      c.req.query('print') === '1' ? 'print' : 'preview',
      nonce,
      {
        expired: isExpired(row),
      },
    );
  })

  /** Starts AI processing (queue). Until M5 only MOCK_AI is available. */
  .post('/:id/process', async (c) => {
    const row = await editable(c);
    if (row instanceof Response) return row;
    if (c.env.MOCK_AI !== '1') {
      return fail(
        c,
        400,
        'ai_unavailable',
        'Przygotowanie oferty z nagrania będzie dostępne wkrótce. Uzupełnij ją ręcznie.',
      );
    }
    const now = Date.now();
    await c.var.db.batch([
      c.var.db
        .update(offers)
        .set({
          status: 'processing',
          processingStep: 'uploaded',
          processingError: null,
          updatedAt: now,
        })
        .where(and(eq(offers.id, row.id), eq(offers.companyId, row.companyId))),
      c.var.db.insert(offerEvents).values(event(row, 'processing_started')),
    ]);
    await c.env.JOBS.send({ type: 'process-offer', offerId: row.id });
    return c.json(
      await toDetail(c.var.db, (await loadOffer(c.var.db, c.var.companyId, row.id))!, c.env.APP_URL),
      202,
    );
  })

  .post('/:id/answers', async (c) => {
    const parsed = await parseBody(c, AnswersInput);
    if (!parsed.ok) return parsed.response;
    const row = await editable(c);
    if (row instanceof Response) return row;
    const answers = { ...(row.aiAnswers ?? {}), ...parsed.data.answers };
    // Re-run extraction with the answers (no speech-to-text again). Mock until M5.
    const fresh =
      c.env.MOCK_AI === '1' && row.priceSnapshot
        ? mockExtraction(row.priceSnapshot.priceList, answers)
        : row.aiExtraction;
    // Answered questions stay with the offer („Pytanie AI: „…” · Ty: Tak”); new ones are added.
    const answered = (row.aiExtraction?.questions ?? []).filter((q) => answers[q.id] !== undefined);
    const extraction = fresh && {
      ...fresh,
      questions: [...answered, ...fresh.questions.filter((q) => !answered.some((a) => a.id === q.id))],
    };
    return update(c, row, { aiAnswers: answers, aiExtraction: extraction });
  })

  .patch('/:id/geometry', async (c) => {
    const parsed = await parseBody(c, GeometryInput);
    if (!parsed.ok) return parsed.response;
    const row = await editable(c);
    if (row instanceof Response) return row;
    const extraction = row.aiExtraction ?? emptyExtraction(row.title);
    const byId = new Map(parsed.data.rooms.map((r) => [r.id, r]));
    return update(c, row, {
      aiExtraction: {
        ...extraction,
        rooms: extraction.rooms.map((room) => {
          const r = byId.get(room.id);
          return r ? { ...room, lengthM: r.lengthM, widthM: r.widthM, heightM: r.heightM } : room;
        }),
      },
    });
  })

  .patch('/:id', async (c) => {
    const parsed = await parseBody(c, OfferPatch);
    if (!parsed.ok) return parsed.response;
    const row = await editable(c);
    if (row instanceof Response) return row;
    const change = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
    return update(c, row, change as Partial<OfferRow>);
  })

  .post('/:id/items', async (c) => {
    const parsed = await parseBody(c, AddOfferItemInput);
    if (!parsed.ok) return parsed.response;
    const row = await editable(c);
    if (row instanceof Response) return row;
    const { db, companyId } = c.var;
    const input = parsed.data;
    let unitPriceGr = input.unitPriceGr;
    if (input.priceListItemId) {
      const item = await db
        .select()
        .from(priceListItems)
        .where(and(eq(priceListItems.id, input.priceListItemId), eq(priceListItems.companyId, companyId)))
        .get();
      if (!item) return fail(c, 400, 'validation', 'Nie ma takiej pozycji w cenniku.');
      // Price copied from the price list now (docs/04: the offer keeps its copy).
      if (unitPriceGr === undefined) unitPriceGr = item.priceGr;
    }
    const add: OfferItemOverride = {
      kind: 'add',
      key: `manual:${crypto.randomUUID()}`,
      priceListItemId: input.priceListItemId,
      name: input.name,
      unit: input.unit,
      qtyMilli: input.qtyMilli,
      unitPriceGr: unitPriceGr ?? null,
    };
    return update(c, row, { overrides: [...row.overrides, add] });
  })

  .patch('/:id/items/:key', async (c) => {
    const parsed = await parseBody(c, OfferItemPatch);
    if (!parsed.ok) return parsed.response;
    const row = await editable(c);
    if (row instanceof Response) return row;
    const key = c.req.param('key');
    const current = computeOffer(row).items.find((i) => i.key === key);
    if (!current || current.sourceKind === 'rule')
      return fail(c, 404, 'not_found', 'Nie ma takiej pozycji w ofercie.');
    const { saveToPriceList, ...patch } = parsed.data;

    let overrides: OfferItemOverride[];
    if (current.sourceKind === 'manual') {
      overrides = row.overrides.map((o) => (o.kind === 'add' && o.key === key ? { ...o, ...patch } : o));
    } else {
      const previous = row.overrides.find((o) => o.kind === 'edit' && o.key === key);
      const edit: OfferItemOverride = { ...(previous ?? {}), ...patch, kind: 'edit', key };
      overrides = [...row.overrides.filter((o) => !(o.kind === 'edit' && o.key === key)), edit];
    }

    const extra: BatchItem<'sqlite'>[] = [];
    const name = patch.name ?? current.name;
    // The offer keeps its snapshot, so the item stays „missing” here – do not add it to the price list twice.
    const alreadySaved =
      saveToPriceList &&
      (await c.var.db
        .select({ id: priceListItems.id })
        .from(priceListItems)
        .where(
          and(
            eq(priceListItems.companyId, row.companyId),
            eq(priceListItems.sourceOfferId, row.id),
            eq(priceListItems.name, name),
            eq(priceListItems.unit, current.unit),
            isNull(priceListItems.archivedAt),
          ),
        )
        .get());
    if (saveToPriceList && !alreadySaved && current.priceListItemId === null && patch.unitPriceGr != null) {
      const now = Date.now();
      const snapshot = row.priceSnapshot?.priceList ?? [];
      // Category: where this unit already lives in the price list (e.g. „Montaż” for kpl), else „Inne”.
      const sameUnit = snapshot.find((p) => p.unit === current.unit && p.category);
      extra.push(
        c.var.db.insert(priceListItems).values({
          id: crypto.randomUUID(),
          companyId: row.companyId,
          category: sameUnit?.category ?? 'Inne',
          name,
          unit: current.unit,
          priceGr: patch.unitPriceGr,
          measure: current.scope ?? 'manual',
          source: 'offer',
          sourceOfferId: row.id,
          sortOrder: 10_000,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }
    return update(c, row, { overrides }, extra);
  })

  .delete('/:id/items/:key', async (c) => {
    const row = await editable(c);
    if (row instanceof Response) return row;
    const key = c.req.param('key');
    const current = computeOffer(row).items.find((i) => i.key === key);
    if (!current || current.sourceKind === 'rule')
      return fail(c, 404, 'not_found', 'Nie ma takiej pozycji w ofercie.');
    const overrides: OfferItemOverride[] =
      current.sourceKind === 'manual'
        ? row.overrides.filter((o) => !(o.kind === 'add' && o.key === key))
        : [...row.overrides.filter((o) => o.key !== key), { kind: 'remove', key }];
    return update(c, row, { overrides });
  })

  /** „Odśwież ceny z cennika” (docs/04). */
  .post('/:id/refresh-prices', async (c) => {
    const row = await editable(c);
    if (row instanceof Response) return row;
    return update(c, row, { priceSnapshot: await takeSnapshot(c.var.db, c.var.companyId) });
  })

  .post('/:id/send', async (c) => {
    const parsed = await parseBody(c, SendInput);
    if (!parsed.ok) return parsed.response;
    const { db, companyId } = c.var;
    const row = await loadOffer(db, companyId, c.req.param('id'));
    if (!row) return fail(c, 404, 'not_found', NOT_FOUND);
    if (row.status === 'accepted') return fail(c, 409, 'accepted', 'Oferta jest już zaakceptowana.');
    if (row.status === 'processing') return fail(c, 409, 'processing', 'AI jeszcze układa ofertę.');
    // A rejected or expired offer cannot be revived by resending – the client would still see „nieaktualna”.
    if (isSentStatus(row.status) && isExpired(row)) {
      return fail(c, 409, 'not_current', 'Ta oferta jest nieaktualna. Przygotuj nową ofertę.');
    }
    const result = computeOffer(row);
    if (result.missingPriceCount > 0) {
      return fail(c, 422, 'missing_prices', 'Uzupełnij ceny wszystkich pozycji, zanim wyślesz ofertę.');
    }
    if (!result.canSend) return fail(c, 422, 'empty', 'Dodaj co najmniej jedną pozycję z ceną.');

    const now = Date.now();
    let number = row.number;
    if (!number) {
      // Number per company per month: RRRR/MM/NNN (atomic counter).
      const month = warsawMonth(now);
      const counter = await db
        .update(companies)
        .set({
          offerCounter: sql`case when ${companies.offerCounterMonth} = ${month} then ${companies.offerCounter} + 1 else 1 end`,
          offerCounterMonth: month,
        })
        .where(eq(companies.id, companyId))
        .returning({ n: companies.offerCounter })
        .get();
      number = `${month.replace('-', '/')}/${String(counter!.n).padStart(3, '0')}`;
    }
    const status = row.status === 'opened' ? 'opened' : 'sent';
    await db.batch([
      db
        .update(offers)
        .set({ number, status, sendChannel: parsed.data.channel, sentAt: row.sentAt ?? now, updatedAt: now })
        .where(and(eq(offers.id, row.id), eq(offers.companyId, companyId))),
      ...persistResult(db, row, result, now),
      db.insert(offerEvents).values(event(row, 'sent', { channel: parsed.data.channel })),
    ] as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
    const sent = (await loadOffer(db, companyId, row.id))!;
    const detail = await toDetail(db, sent, c.env.APP_URL);
    return c.json<SendResponse>({ offer: detail, link: detail.link });
  })

  .post('/:id/reject', async (c) => {
    const { db, companyId } = c.var;
    const row = await loadOffer(db, companyId, c.req.param('id'));
    if (!row) return fail(c, 404, 'not_found', NOT_FOUND);
    if (row.status === 'accepted') return fail(c, 409, 'accepted', 'Oferta jest już zaakceptowana.');
    // A rejected offer is visible on /o/:token – only one the contractor has sent can be rejected (rule 4).
    if (!isSentStatus(row.status)) return fail(c, 409, 'not_sent', 'Oferta nie została jeszcze wysłana.');
    await db.batch([
      db
        .update(offers)
        .set({ status: 'rejected', updatedAt: Date.now() })
        .where(and(eq(offers.id, row.id), eq(offers.companyId, companyId))),
      db.insert(offerEvents).values(event(row, 'rejected')),
    ]);
    return c.json(await toDetail(db, (await loadOffer(db, companyId, row.id))!, c.env.APP_URL));
  });
