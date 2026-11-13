import { z } from 'zod';
import { isValidNip, normalizeNip } from './nip';
import { normalizePlPhone } from './phone';
import { Unit } from './schemas';

/**
 * Request/response shapes shared by the worker (validation) and the web app (forms, types).
 * Error messages are Polish – they are shown in forms.
 */

export interface ApiError {
  error: { code: string; message: string };
}

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

// --- Onboarding ------------------------------------------------------------

export const OnboardingTradesInput = z
  .object({
    trades: z.array(z.string().min(1).max(40)).max(8),
    customTrade: z.preprocess(emptyToNull, z.string().trim().max(200).nullable()).optional(),
  })
  .refine((v) => v.trades.length > 0 || !!v.customTrade, {
    message: 'Zaznacz co najmniej jedną profesję albo opisz swoją.',
    path: ['trades'],
  });
export type OnboardingTradesInput = z.infer<typeof OnboardingTradesInput>;

export const OnboardingRatesInput = z.object({
  items: z
    .array(z.object({ templateKey: z.string().min(1), priceGr: z.number().int().nonnegative().nullable() }))
    .max(200),
  custom: z
    .array(
      z.object({
        name: z.string().trim().min(1, 'Wpisz nazwę pozycji.').max(120),
        unit: Unit,
        category: z.string().trim().max(60).default('Inne'),
        priceGr: z.number().int().nonnegative(),
      }),
    )
    .max(100)
    .default([]),
});
export type OnboardingRatesInput = z.input<typeof OnboardingRatesInput>;

export interface OnboardingRateItem {
  templateKey: string;
  trade: string;
  category: string;
  name: string;
  unit: Unit;
  priceGr: number | null;
}

export interface OnboardingRatesResponse {
  trades: { trade: string; label: string }[];
  items: OnboardingRateItem[];
  custom: { name: string; unit: Unit; category: string; priceGr: number }[];
}

// --- Company -----------------------------------------------------------------

export const VALIDITY_DAYS = [7, 14, 30] as const;
export const DEPOSIT_BPS = [0, 2000, 3000, 5000] as const;
export const VAT_BPS = [800, 2300] as const;

export const CompanyInput = z.object({
  ownerName: z.string().trim().min(2, 'Wpisz imię i nazwisko.').max(80),
  name: z.string().trim().min(2, 'Wpisz nazwę firmy.').max(120),
  nip: z.preprocess(
    emptyToNull,
    z.string().refine(isValidNip, 'Nieprawidłowy NIP – sprawdź cyfry.').transform(normalizeNip).nullable(),
  ),
  phone: z.preprocess(
    emptyToNull,
    z
      .string()
      .refine((v) => normalizePlPhone(v) !== null, 'Wpisz 9 cyfr numeru telefonu.')
      .transform((v) => normalizePlPhone(v)!)
      .nullable(),
  ),
  email: z.preprocess(emptyToNull, z.email('Nieprawidłowy adres e-mail.').max(200).nullable()),
  serviceArea: z.preprocess(emptyToNull, z.string().trim().max(120).nullable()),
  defaultValidityDays: z.union(VALIDITY_DAYS.map((d) => z.literal(d))),
  defaultDepositBps: z.union(DEPOSIT_BPS.map((d) => z.literal(d))),
  defaultVatBps: z.union([...VAT_BPS.map((d) => z.literal(d)), z.null()]),
  /** Last onboarding step („Gotowe – zrób pierwszą ofertę”). */
  finishOnboarding: z.boolean().optional(),
});
export type CompanyInput = z.input<typeof CompanyInput>;
export type CompanyData = z.output<typeof CompanyInput>;

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = ['image/png', 'image/jpeg'] as const;

// --- /api/me -----------------------------------------------------------------

export type OnboardingStep = 'profesja' | 'stawki' | 'firma' | null;

export interface Company {
  id: string;
  name: string;
  nip: string | null;
  phone: string | null;
  email: string | null;
  serviceArea: string | null;
  hasLogo: boolean;
  logoVersion: number | null;
  trades: string[];
  customTrade: string | null;
  defaultValidityDays: number;
  defaultDepositBps: number;
  defaultVatBps: number | null;
  plan: 'free' | 'pro' | 'team';
}

export interface MeResponse {
  user: { id: string; name: string; phoneNumber: string | null; email: string | null };
  company: Company;
  usage: { used: number; limit: number | null; resetsAt: string };
  needsOnboarding: boolean;
  onboardingStep: OnboardingStep;
}
