import { describe, expect, it } from 'vitest';
import { CompanyInput, OnboardingRatesInput, OnboardingTradesInput } from '../src/api';
import { PLANS, nextMonthStart, warsawMonth } from '../src/plans';

describe('plans', () => {
  it('free plan: 3 offers a month, Pro unlimited at 59 zł / 590 zł', () => {
    expect(PLANS.free.offersPerMonth).toBe(3);
    expect(PLANS.pro.offersPerMonth).toBeNull();
    expect(PLANS.pro.monthlyNetGr).toBe(5900);
    expect(PLANS.pro.yearlyNetGr).toBe(59000);
  });

  it('months are counted in Europe/Warsaw', () => {
    // 30.11.2026 23:30 UTC = 1.12.2026 00:30 in Warsaw (CET, UTC+1)
    expect(warsawMonth(Date.UTC(2026, 10, 30, 23, 30))).toBe('2026-12');
    expect(warsawMonth(Date.UTC(2026, 10, 30, 22, 30))).toBe('2026-11');
    // Summer time (CEST, UTC+2): 31.07 22:30 UTC = 1.08 00:30
    expect(warsawMonth(new Date(Date.UTC(2026, 6, 31, 22, 30)))).toBe('2026-08');
  });

  it('next month start', () => {
    expect(nextMonthStart('2026-11')).toBe('2026-12-01');
    expect(nextMonthStart('2026-12')).toBe('2027-01-01');
  });
});

describe('API input schemas', () => {
  const company = {
    ownerName: 'Marek Nowak',
    name: 'Usługi Glazurnicze Nowak',
    nip: '526-025-02-74',
    phone: '600 000 000',
    email: '',
    serviceArea: 'Warszawa i okolice',
    defaultValidityDays: 14,
    defaultDepositBps: 3000,
    defaultVatBps: 800,
  };

  it('normalizes NIP, phone and empty strings', () => {
    expect(CompanyInput.parse(company)).toEqual({
      ...company,
      nip: '5260250274',
      phone: '+48600000000',
      email: null,
    });
  });

  it('accepts VAT exempt (null) and no deposit', () => {
    const r = CompanyInput.parse({ ...company, defaultVatBps: null, defaultDepositBps: 0, nip: '' });
    expect(r.defaultVatBps).toBeNull();
    expect(r.nip).toBeNull();
  });

  it('rejects an invalid NIP, phone, e-mail and VAT with Polish messages', () => {
    const r = CompanyInput.safeParse({
      ...company,
      nip: '5260250275',
      phone: '123',
      email: 'x@',
      defaultVatBps: 500,
    });
    expect(r.success).toBe(false);
    const messages = r.error!.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    expect(messages).toContain('nip: Nieprawidłowy NIP – sprawdź cyfry.');
    expect(messages).toContain('phone: Wpisz 9 cyfr numeru telefonu.');
    expect(messages).toContain('email: Nieprawidłowy adres e-mail.');
    expect(messages.some((m) => m.startsWith('defaultVatBps'))).toBe(true);
  });

  it('requires a trade or a custom description', () => {
    expect(OnboardingTradesInput.safeParse({ trades: [] }).success).toBe(false);
    expect(OnboardingTradesInput.safeParse({ trades: [], customTrade: '  ' }).success).toBe(false);
    expect(OnboardingTradesInput.parse({ trades: [], customTrade: 'Kominiarz' }).customTrade).toBe(
      'Kominiarz',
    );
    expect(OnboardingTradesInput.parse({ trades: ['glazurnik'] }).trades).toEqual(['glazurnik']);
  });

  it('rates: prices are integer grosze, custom items default to category „Inne”', () => {
    const r = OnboardingRatesInput.parse({
      items: [{ templateKey: 'glazurnik.skucie_plytek', priceGr: 4500 }],
      custom: [{ name: 'Wywóz gruzu', unit: 'kpl', priceGr: 30000 }],
    });
    expect(r.custom[0]!.category).toBe('Inne');
    expect(OnboardingRatesInput.safeParse({ items: [{ templateKey: 'x', priceGr: 45.5 }] }).success).toBe(
      false,
    );
  });
});
