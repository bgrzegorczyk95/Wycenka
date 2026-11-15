import {
  AddTradeInput,
  DEFAULT_RULES,
  PriceListItemInput,
  PriceListItemPatch,
  PricingRuleInput,
  PricingRuleKind,
  getTemplate,
  onboardingItems,
  unitLabel,
  type PriceListEntry,
  type PriceListResponse,
  type Scope,
  type Unit,
} from '@wycenka/core';
import { clients, companies, offers, priceListItems, pricingRules } from '@wycenka/db';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { Hono } from 'hono';
import type { Db } from '../db';
import { fail, parseBody, type AppEnv } from '../http';
import { createXlsx } from '../lib/xlsx';
import { getCompanyRow } from './me';

/** „nowa” badge and the „Dodano z oferty” banner: items added from offers in the last 14 days. */
const NEW_FROM_OFFER_MS = 14 * 24 * 60 * 60 * 1000;

type ItemRow = typeof priceListItems.$inferSelect;

/** Custom items: the AI picks the scope per offer; counts for pieces and sets. */
const defaultMeasure = (unit: Unit): Scope => (unit === 'szt' || unit === 'kpl' ? 'count' : 'manual');

function toEntry(row: ItemRow, now: number): PriceListEntry {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    offerName: row.offerName,
    unit: row.unit,
    priceGr: row.priceGr,
    measure: row.measure,
    source: row.source,
    isNew: row.source === 'offer' && now - row.createdAt < NEW_FROM_OFFER_MS,
    sortOrder: row.sortOrder,
  };
}

async function activeItems(db: Db, companyId: string): Promise<ItemRow[]> {
  return db
    .select()
    .from(priceListItems)
    .where(and(eq(priceListItems.companyId, companyId), isNull(priceListItems.archivedAt)))
    .orderBy(asc(priceListItems.sortOrder), asc(priceListItems.createdAt))
    .all();
}

/** „Łazienka – A. Kowalska” */
function offerLabel(title: string, clientName: string | null): string {
  if (!clientName) return title;
  const parts = clientName.trim().split(/\s+/);
  const short = parts.length > 1 ? `${parts[0]![0]}. ${parts.slice(1).join(' ')}` : parts[0]!;
  return `${title} – ${short}`;
}

async function buildPriceList(db: Db, companyId: string): Promise<PriceListResponse> {
  const now = Date.now();
  const company = await getCompanyRow(db, companyId);
  const rows = await activeItems(db, companyId);
  const ruleRows = await db.select().from(pricingRules).where(eq(pricingRules.companyId, companyId)).all();
  const ruleOrder = DEFAULT_RULES.map((r) => r.kind);

  const recent = rows.filter((r) => toEntry(r, now).isNew && r.sourceOfferId);
  const offerIds = [...new Set(recent.map((r) => r.sourceOfferId!))];
  const offerRows = offerIds.length
    ? await db
        .select({ id: offers.id, title: offers.title, clientName: clients.name })
        .from(offers)
        .leftJoin(clients, eq(clients.id, offers.clientId))
        .where(and(eq(offers.companyId, companyId), inArray(offers.id, offerIds)))
        .all()
    : [];
  const offerById = new Map(offerRows.map((o) => [o.id, o]));

  return {
    trades: company.trades.map((t) => ({ trade: t, label: getTemplate(t)?.label ?? t })),
    items: rows.map((r) => toEntry(r, now)),
    rules: ruleRows
      .sort((a, b) => ruleOrder.indexOf(a.kind) - ruleOrder.indexOf(b.kind))
      .map((r) => ({
        kind: r.kind,
        label: r.label,
        bps: r.bps,
        amountGr: r.amountGr,
        thresholdMilli: r.thresholdMilli,
        enabled: r.enabled,
      })),
    recentFromOffers: recent.flatMap((r) => {
      const offer = offerById.get(r.sourceOfferId!);
      return offer
        ? [
            {
              itemId: r.id,
              name: r.offerName ?? r.name,
              unit: r.unit,
              priceGr: r.priceGr,
              offerLabel: offerLabel(offer.title, offer.clientName),
            },
          ]
        : [];
    }),
  };
}

async function findItem(db: Db, companyId: string, id: string): Promise<ItemRow | undefined> {
  return db
    .select()
    .from(priceListItems)
    .where(
      and(
        eq(priceListItems.id, id),
        eq(priceListItems.companyId, companyId),
        isNull(priceListItems.archivedAt),
      ),
    )
    .get();
}

const NOT_FOUND = 'Nie ma takiej pozycji w cenniku.';

export const priceListRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await buildPriceList(c.var.db, c.var.companyId)))

  .post('/items', async (c) => {
    const parsed = await parseBody(c, PriceListItemInput);
    if (!parsed.ok) return parsed.response;
    const { db, companyId } = c.var;
    const now = Date.now();
    const last = (await activeItems(db, companyId)).at(-1);
    const id = crypto.randomUUID();
    await db.insert(priceListItems).values({
      id,
      companyId,
      category: parsed.data.category,
      name: parsed.data.name,
      offerName: parsed.data.offerName ?? null,
      unit: parsed.data.unit,
      priceGr: parsed.data.priceGr,
      measure: parsed.data.measure ?? defaultMeasure(parsed.data.unit),
      source: 'manual',
      sortOrder: (last?.sortOrder ?? 0) + 1,
      createdAt: now,
      updatedAt: now,
    });
    return c.json(toEntry((await findItem(db, companyId, id))!, now), 201);
  })

  .patch('/items/:id', async (c) => {
    const parsed = await parseBody(c, PriceListItemPatch);
    if (!parsed.ok) return parsed.response;
    const { db, companyId } = c.var;
    const existing = await findItem(db, companyId, c.req.param('id'));
    if (!existing) return fail(c, 404, 'not_found', NOT_FOUND);
    const now = Date.now();
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
    await db
      .update(priceListItems)
      .set({ ...patch, updatedAt: now })
      .where(and(eq(priceListItems.id, existing.id), eq(priceListItems.companyId, companyId)));
    return c.json(toEntry({ ...existing, ...patch, updatedAt: now } as ItemRow, now));
  })

  .delete('/items/:id', async (c) => {
    const { db, companyId } = c.var;
    const existing = await findItem(db, companyId, c.req.param('id'));
    if (!existing) return fail(c, 404, 'not_found', NOT_FOUND);
    // Archive, never delete: the item may be referenced by sent offers.
    await db
      .update(priceListItems)
      .set({ archivedAt: Date.now() })
      .where(and(eq(priceListItems.id, existing.id), eq(priceListItems.companyId, companyId)));
    return c.body(null, 204);
  })

  .put('/rules/:kind', async (c) => {
    const kind = PricingRuleKind.safeParse(c.req.param('kind'));
    if (!kind.success) return fail(c, 404, 'not_found', 'Nie ma takiej zasady.');
    const parsed = await parseBody(c, PricingRuleInput);
    if (!parsed.ok) return parsed.response;
    const { db, companyId } = c.var;
    const defaults = DEFAULT_RULES.find((r) => r.kind === kind.data)!;
    const values = {
      enabled: parsed.data.enabled,
      bps: parsed.data.bps ?? null,
      amountGr: parsed.data.amountGr ?? null,
      thresholdMilli: parsed.data.thresholdMilli ?? null,
    };
    // Keep only the fields this kind uses.
    if (defaults.bps === undefined) values.bps = null;
    if (defaults.amountGr === undefined) values.amountGr = null;
    if (defaults.thresholdMilli === undefined) values.thresholdMilli = null;
    if (values.enabled && [values.bps, values.amountGr].every((v) => v === null)) {
      return fail(c, 400, 'validation', 'Wpisz wartość albo wyłącz tę zasadę.');
    }
    await db
      .insert(pricingRules)
      .values({ id: crypto.randomUUID(), companyId, kind: kind.data, label: defaults.label, ...values })
      .onConflictDoUpdate({ target: [pricingRules.companyId, pricingRules.kind], set: values });
    return c.json(await buildPriceList(db, companyId));
  })

  /** Template of another trade („Robisz też inne prace?”): items not yet in the price list, without prices. */
  .get('/templates/:trade', async (c) => {
    const template = getTemplate(c.req.param('trade'));
    if (!template) return fail(c, 404, 'not_found', 'Nieznana branża.');
    const rows = await activeItems(c.var.db, c.var.companyId);
    const names = new Set(rows.map((r) => r.name.toLowerCase()));
    const keys = new Set(rows.map((r) => r.templateKey));
    return c.json({
      trades: [{ trade: template.trade, label: template.label }],
      items: onboardingItems([template.trade])
        .filter((i) => !keys.has(i.templateKey) && !names.has(i.name.toLowerCase()))
        .map((i) => ({
          templateKey: i.templateKey,
          trade: i.trade,
          category: i.category,
          name: i.name,
          unit: i.unit,
          priceGr: null,
        })),
      custom: [],
    });
  })

  .post('/templates', async (c) => {
    const parsed = await parseBody(c, AddTradeInput);
    if (!parsed.ok) return parsed.response;
    const template = getTemplate(parsed.data.trade);
    if (!template) return fail(c, 400, 'validation', 'Nieznana branża.');
    const { db, companyId } = c.var;
    const now = Date.now();
    const company = await getCompanyRow(db, companyId);
    const rows = await activeItems(db, companyId);
    const prices = new Map(parsed.data.items.map((i) => [i.templateKey, i.priceGr]));
    const lastOrder = rows.at(-1)?.sortOrder ?? 0;
    const priced = onboardingItems([template.trade]).filter((i) => prices.get(i.templateKey) != null);

    const statements: BatchItem<'sqlite'>[] = priced.map((i, n) =>
      db
        .insert(priceListItems)
        .values({
          id: crypto.randomUUID(),
          companyId,
          category: i.category,
          name: i.name,
          offerName: i.offerName,
          unit: i.unit,
          priceGr: prices.get(i.templateKey)!,
          measure: i.measure,
          tags: i.tags,
          aliases: i.aliases,
          source: 'template',
          templateKey: i.templateKey,
          sortOrder: lastOrder + 1 + n,
          createdAt: now,
          updatedAt: now,
        })
        // A previously archived template item comes back with the new price.
        .onConflictDoUpdate({
          target: [priceListItems.companyId, priceListItems.templateKey],
          set: {
            priceGr: prices.get(i.templateKey)!,
            archivedAt: null,
            sortOrder: lastOrder + 1 + n,
            updatedAt: now,
          },
        }),
    );
    statements.push(
      db
        .update(companies)
        .set({
          trades: company.trades.includes(template.trade)
            ? company.trades
            : [...company.trades, template.trade],
          updatedAt: now,
        })
        .where(eq(companies.id, companyId)),
    );
    await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
    return c.json(await buildPriceList(db, companyId));
  })

  .get('/export.xlsx', async (c) => {
    const { db, companyId } = c.var;
    const company = await getCompanyRow(db, companyId);
    const rows = await activeItems(db, companyId);
    const file = createXlsx({
      sheetName: 'Cennik',
      columns: [
        { header: 'Pozycja', width: 42 },
        { header: 'Nazwa na ofercie', width: 42 },
        { header: 'Kategoria', width: 20 },
        { header: 'Jednostka', width: 11 },
        { header: 'Cena netto (zł)', width: 16, format: 'money' },
      ],
      rows: rows.map((r) => [r.name, r.offerName, r.category, unitLabel(r.unit), r.priceGr]),
    });
    const base = `Cennik-${company.name || 'Wycenka'}`.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/-+$/, '');
    return new Response(file, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="cennik.xlsx"; filename*=UTF-8''${encodeURIComponent(base)}.xlsx`,
        'Cache-Control': 'no-store',
      },
    });
  });
