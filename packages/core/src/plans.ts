/**
 * Plans and limits (docs/01-produkt.md „Plany”). Prices are assumptions to validate with contractors –
 * keep them here (config), never in UI code.
 */

export type PlanId = 'free' | 'pro' | 'team';

export interface PlanConfig {
  id: PlanId;
  label: string;
  /** Offers processed by AI per calendar month (Europe/Warsaw); null = unlimited. */
  offersPerMonth: number | null;
  monthlyNetGr: number | null;
  yearlyNetGr: number | null;
  logo: boolean;
  footer: boolean;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    label: 'Darmowy',
    offersPerMonth: 3,
    monthlyNetGr: 0,
    yearlyNetGr: 0,
    logo: false,
    footer: true,
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    offersPerMonth: null,
    monthlyNetGr: 5900,
    yearlyNetGr: 59000,
    logo: true,
    footer: false,
  },
  team: {
    id: 'team',
    label: 'Ekipa',
    offersPerMonth: null,
    monthlyNetGr: 9900,
    yearlyNetGr: null,
    logo: true,
    footer: false,
  },
};

export const TIME_ZONE = 'Europe/Warsaw';

const monthFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
});

/** Calendar month in Europe/Warsaw: '2026-11'. */
export function warsawMonth(at: Date | number): string {
  const parts = Object.fromEntries(monthFormat.formatToParts(at).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}`;
}

/** First day of the following month: '2026-11' → '2026-12-01'. */
export function nextMonthStart(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
