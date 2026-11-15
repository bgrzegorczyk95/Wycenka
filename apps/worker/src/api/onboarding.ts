import {
  DEFAULT_RULES,
  OnboardingRatesInput,
  OnboardingTradesInput,
  getTemplate,
  onboardingItems,
  type OnboardingRatesResponse,
  type Scope,
  type Unit,
} from '@wycenka/core';
import { companies, priceListItems, pricingRules } from '@wycenka/db';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { Hono } from 'hono';
import type { Db } from '../db';
import { fail, parseBody, type AppEnv } from '../http';
import { getCompanyRow } from './me';

const CUSTOM_CATEGORY = 'Własne';

/** Custom items have no geometry rule; the AI picks the scope per offer. */
function measureForUnit(unit: Unit): Scope {
  return unit === 'szt' || unit === 'kpl' ? 'count' : 'manual';
}

async function ratesResponse(db: Db, companyId: string): Promise<OnboardingRatesResponse> {
  const company = await getCompanyRow(db, companyId);
  const existing = await db
    .select()
    .from(priceListItems)
    .where(and(eq(priceListItems.companyId, companyId), isNull(priceListItems.archivedAt)))
    .orderBy(priceListItems.sortOrder)
    .all();
  const byTemplate = new Map(existing.filter((i) => i.templateKey).map((i) => [i.templateKey!, i]));

  return {
    trades: company.trades.map((t) => ({ trade: t, label: getTemplate(t)?.label ?? t })),
    items: onboardingItems(company.trades).map((i) => ({
      templateKey: i.templateKey,
      trade: i.trade,
      category: i.category,
      name: i.name,
      unit: i.unit,
      priceGr: byTemplate.get(i.templateKey)?.priceGr ?? null,
    })),
    custom: existing
      .filter((i) => i.source === 'manual')
      .map((i) => ({ name: i.name, unit: i.unit, category: i.category, priceGr: i.priceGr })),
  };
}

export const onboardingRoutes = new Hono<AppEnv>()
  .post('/trades', async (c) => {
    const parsed = await parseBody(c, OnboardingTradesInput);
    if (!parsed.ok) return parsed.response;
    const { trades, customTrade } = parsed.data;
    if (trades.some((t) => !getTemplate(t))) {
      return fail(c, 400, 'validation', 'Nieznana profesja.');
    }
    const { db, companyId } = c.var;
    const company = await getCompanyRow(db, companyId);
    await db
      .update(companies)
      .set({
        trades: [...new Set(trades)],
        customTrade: customTrade ?? null,
        onboardingStep: company.onboardingStep === 'profesja' ? 'stawki' : company.onboardingStep,
        updatedAt: Date.now(),
      })
      .where(eq(companies.id, companyId));
    return c.json(await ratesResponse(db, companyId));
  })

  .get('/rates', async (c) => c.json(await ratesResponse(c.var.db, c.var.companyId)))

  .post('/rates', async (c) => {
    const parsed = await parseBody(c, OnboardingRatesInput);
    if (!parsed.ok) return parsed.response;
    const { db, companyId } = c.var;
    const company = await getCompanyRow(db, companyId);
    if (company.onboardingStep === null) {
      return fail(c, 409, 'already_onboarded', 'Cennik zmienisz na ekranie „Cennik”.');
    }

    const now = Date.now();
    const prices = new Map(parsed.data.items.map((i) => [i.templateKey, i.priceGr]));
    const template = onboardingItems(company.trades);
    // Only items with a price go to the price list (docs/01: „Puste pozycje nie trafiają do cennika”).
    const priced = template.filter((i) => prices.get(i.templateKey) != null);

    const statements: BatchItem<'sqlite'>[] = [
      // Onboarding can be repeated (back button): replace what this step created before.
      db
        .delete(priceListItems)
        .where(and(eq(priceListItems.companyId, companyId), isNotNull(priceListItems.templateKey))),
      db
        .delete(priceListItems)
        .where(and(eq(priceListItems.companyId, companyId), eq(priceListItems.source, 'manual'))),
    ];

    const rows: (typeof priceListItems.$inferInsert)[] = [
      ...priced.map((i, sortOrder) => ({
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
        source: 'template' as const,
        templateKey: i.templateKey,
        sortOrder,
        createdAt: now,
        updatedAt: now,
      })),
      ...parsed.data.custom.map((i, n) => ({
        id: crypto.randomUUID(),
        companyId,
        category: i.category === 'Inne' ? CUSTOM_CATEGORY : i.category,
        name: i.name,
        unit: i.unit,
        priceGr: i.priceGr,
        measure: measureForUnit(i.unit),
        source: 'manual' as const,
        sortOrder: priced.length + n,
        createdAt: now,
        updatedAt: now,
      })),
    ];
    // D1 limits bound parameters per statement – insert in small chunks.
    for (let i = 0; i < rows.length; i += 5) {
      statements.push(db.insert(priceListItems).values(rows.slice(i, i + 5)));
    }

    statements.push(
      db
        .insert(pricingRules)
        .values(
          DEFAULT_RULES.map((r) => ({
            id: crypto.randomUUID(),
            companyId,
            kind: r.kind,
            label: r.label,
            bps: r.bps ?? null,
            amountGr: r.amountGr ?? null,
            thresholdMilli: r.thresholdMilli ?? null,
            enabled: r.enabled,
          })),
        )
        .onConflictDoNothing(),
      db
        .update(companies)
        .set({
          onboardingStep: company.onboardingStep === 'stawki' ? 'firma' : company.onboardingStep,
          updatedAt: now,
        })
        .where(eq(companies.id, companyId)),
    );

    await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
    return c.json({ saved: rows.length });
  });
