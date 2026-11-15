import {
  PLANS,
  nextMonthStart,
  warsawMonth,
  type Company,
  type MeResponse,
  type OnboardingStep,
} from '@wycenka/core';
import { companies, offers } from '@wycenka/db';
import { and, count, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { PHONE_EMAIL_DOMAIN } from '../auth';
import type { Db } from '../db';
import type { AppEnv, SessionUser } from '../http';

type CompanyRow = typeof companies.$inferSelect;

export function toCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    nip: row.nip,
    phone: row.phone,
    email: row.email,
    serviceArea: row.serviceArea,
    hasLogo: row.logoKey !== null,
    logoVersion: row.logoKey !== null ? row.updatedAt : null,
    trades: row.trades,
    customTrade: row.customTrade,
    defaultValidityDays: row.defaultValidityDays,
    defaultDepositBps: row.defaultDepositBps,
    defaultVatBps: row.defaultVatBps,
    plan: row.plan,
  };
}

export async function getCompanyRow(db: Db, companyId: string): Promise<CompanyRow> {
  const row = await db.select().from(companies).where(eq(companies.id, companyId)).get();
  if (!row) throw new Error('Company missing for session');
  return row;
}

export async function buildMe(
  db: Db,
  user: SessionUser,
  companyId: string,
  env: { MOCK_AI?: string | undefined },
): Promise<MeResponse> {
  const row = await getCompanyRow(db, companyId);
  const month = warsawMonth(Date.now());
  const used = await db
    .select({ n: count() })
    .from(offers)
    .where(and(eq(offers.companyId, companyId), eq(offers.countedForPlanMonth, month)))
    .get();

  return {
    user: {
      id: user.id,
      name: user.name,
      phoneNumber: user.phoneNumber,
      email: user.email.endsWith(`@${PHONE_EMAIL_DOMAIN}`) ? null : user.email,
    },
    company: toCompany(row),
    usage: { used: used?.n ?? 0, limit: PLANS[row.plan].offersPerMonth, resetsAt: nextMonthStart(month) },
    needsOnboarding: row.onboardingStep !== null,
    onboardingStep: row.onboardingStep as OnboardingStep,
    features: { mockAi: env.MOCK_AI === '1' },
  };
}

export const meRoutes = new Hono<AppEnv>().get('/', async (c) =>
  c.json(await buildMe(c.var.db, c.var.user, c.var.companyId, c.env)),
);
