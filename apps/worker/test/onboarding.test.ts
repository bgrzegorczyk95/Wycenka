import type { MeResponse, OnboardingRatesResponse } from '@wycenka/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Env } from '../src/env';
import { devOutbox } from '../src/notify/outbox';
import { Client, createTestEnv } from './setup';

let env: Env;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ env, dispose } = await createTestEnv());
});
afterAll(async () => dispose());

const company = {
  ownerName: 'Marek Nowak',
  name: 'Usługi Glazurnicze Nowak',
  nip: '',
  phone: '600 000 000',
  email: '',
  serviceArea: 'Warszawa i okolice',
  defaultValidityDays: 14,
  defaultDepositBps: 3000,
  defaultVatBps: 800,
};

describe('auth and onboarding (M2 acceptance)', () => {
  it('rejects API calls without a session', async () => {
    const { status, body } = await new Client(env).json('GET', '/api/me');
    expect(status).toBe(401);
    expect(body).toEqual({ error: { code: 'unauthorized', message: 'Zaloguj się, żeby kontynuować.' } });
  });

  it('rejects numbers that are not Polish', async () => {
    const res = await new Client(env).request('POST', '/api/auth/phone-number/send-otp', {
      phoneNumber: '+4915112345678',
    });
    expect(res.status).toBe(400);
  });

  it('new number → profession → rates → company → offers; second login goes straight to offers', async () => {
    const phone = '+48600000001';
    const client = new Client(env);
    await client.loginByPhone(phone);

    // SMS text and no full number in the dev log output
    const sms = devOutbox.findLast((m) => m.to === phone)!;
    expect(sms.text).toMatch(/^Wycenka: kod logowania \d{6}\. Nie podawaj go nikomu\.$/);

    let me = await client.json<MeResponse>('GET', '/api/me');
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      user: { phoneNumber: phone, email: null },
      needsOnboarding: true,
      onboardingStep: 'profesja',
      usage: { used: 0, limit: 3 },
    });
    const companyId = me.body.company.id;

    // Step 1: profession
    const trades = await client.json<OnboardingRatesResponse>('POST', '/api/onboarding/trades', {
      trades: ['glazurnik'],
    });
    expect(trades.status).toBe(200);
    expect(trades.body.trades).toEqual([{ trade: 'glazurnik', label: 'Glazurnik' }]);
    expect(trades.body.items).toHaveLength(11);
    expect(trades.body.items.every((i) => i.priceGr === null)).toBe(true);

    // Step 2: rates – 7 of 11 filled (empty ones do not go to the price list) + one own item
    const prices: Record<string, number> = {
      'glazurnik.skucie_plytek': 4500,
      'glazurnik.gruntowanie': 800,
      'glazurnik.plytki_standard_sciany': 14000,
      'glazurnik.plytki_60x120_sciany': 18000,
      'glazurnik.plytki_podloga': 16000,
      'glazurnik.listwa_naroznik': 4000,
      'glazurnik.stelaz_wc': 65000,
    };
    const saved = await client.json<{ saved: number }>('POST', '/api/onboarding/rates', {
      items: trades.body.items.map((i) => ({
        templateKey: i.templateKey,
        priceGr: prices[i.templateKey] ?? null,
      })),
      custom: [{ name: 'Wywóz gruzu', unit: 'kpl', priceGr: 30000 }],
    });
    expect(saved).toEqual({ status: 200, body: { saved: 8 } });

    const rates = await client.json<OnboardingRatesResponse>('GET', '/api/onboarding/rates');
    expect(rates.body.items.filter((i) => i.priceGr !== null)).toHaveLength(7);
    expect(rates.body.items.find((i) => i.name === 'Stelaż podtynkowy WC')!.priceGr).toBe(65000);
    expect(rates.body.custom).toEqual([
      { name: 'Wywóz gruzu', unit: 'kpl', category: 'Własne', priceGr: 30000 },
    ]);

    // Saving again (back button) replaces instead of duplicating
    await client.json('POST', '/api/onboarding/rates', {
      items: trades.body.items.map((i) => ({
        templateKey: i.templateKey,
        priceGr: prices[i.templateKey] ?? null,
      })),
      custom: [{ name: 'Wywóz gruzu', unit: 'kpl', priceGr: 30000 }],
    });
    const count = await env.DB.prepare('select count(*) as n from price_list_items where company_id = ?')
      .bind(companyId)
      .first<{ n: number }>();
    expect(count!.n).toBe(8);
    const rules = await env.DB.prepare('select kind from pricing_rules where company_id = ?')
      .bind(companyId)
      .all();
    expect(rules.results).toHaveLength(5);

    me = await client.json<MeResponse>('GET', '/api/me');
    expect(me.body.onboardingStep).toBe('firma');

    // Step 3: company data
    const done = await client.json<MeResponse>('PATCH', '/api/company', {
      ...company,
      finishOnboarding: true,
    });
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({
      user: { name: 'Marek Nowak' },
      company: {
        name: 'Usługi Glazurnicze Nowak',
        phone: '+48600000000',
        serviceArea: 'Warszawa i okolice',
        defaultVatBps: 800,
        trades: ['glazurnik'],
      },
      needsOnboarding: false,
      onboardingStep: null,
    });

    // Log out and in again → same company, no onboarding
    expect((await client.request('POST', '/api/auth/sign-out', {})).status).toBe(200);
    expect((await client.json('GET', '/api/me')).status).toBe(401);
    await client.loginByPhone(phone);
    me = await client.json<MeResponse>('GET', '/api/me');
    expect(me.body.company.id).toBe(companyId);
    expect(me.body.needsOnboarding).toBe(false);

    // After onboarding the rates step is closed (price list editing is M3)
    const again = await client.json('POST', '/api/onboarding/rates', { items: [] });
    expect(again.status).toBe(409);
  });

  it('validates input with Polish messages', async () => {
    const client = new Client(env);
    await client.loginByPhone('+48600000002');
    const bad = await client.json<{ error: { message: string } }>('PATCH', '/api/company', {
      ...company,
      nip: '1234567890',
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error.message).toBe('Nieprawidłowy NIP – sprawdź cyfry.');

    const noTrade = await client.json<{ error: { message: string } }>('POST', '/api/onboarding/trades', {
      trades: [],
    });
    expect(noTrade.body.error.message).toBe('Zaznacz co najmniej jedną profesję albo opisz swoją.');

    const unknown = await client.json('POST', '/api/onboarding/trades', { trades: ['astronauta'] });
    expect(unknown.status).toBe(400);
  });

  it('„Inna profesja” gives an empty rates list', async () => {
    const client = new Client(env);
    await client.loginByPhone('+48600000003');
    const r = await client.json<OnboardingRatesResponse>('POST', '/api/onboarding/trades', {
      trades: [],
      customTrade: 'Kominiarz',
    });
    expect(r.body.items).toEqual([]);
    expect((await client.json<MeResponse>('GET', '/api/me')).body.company.customTrade).toBe('Kominiarz');
  });

  it('logs in with an e-mail code', async () => {
    const client = new Client(env);
    const email = 'marek@example.com';
    const before = devOutbox.length;
    const sent = await client.request('POST', '/api/auth/email-otp/send-verification-otp', {
      email,
      type: 'sign-in',
    });
    expect(sent.status).toBe(200);
    const mail = devOutbox.slice(before).find((m) => m.to === email)!;
    expect(mail.subject).toBe('Kod logowania do Wycenki');
    const otp = /(\d{6})/.exec(mail.text)![1];
    expect((await client.request('POST', '/api/auth/sign-in/email-otp', { email, otp })).status).toBe(200);
    const me = await client.json<MeResponse>('GET', '/api/me');
    expect(me.body.user.email).toBe(email);
    expect(me.body.needsOnboarding).toBe(true);
  });

  it('a wrong code does not log in', async () => {
    const client = new Client(env);
    const phone = '+48600000004';
    await client.request('POST', '/api/auth/phone-number/send-otp', { phoneNumber: phone });
    const res = await client.request('POST', '/api/auth/phone-number/verify', {
      phoneNumber: phone,
      code: '000000',
    });
    expect(res.status).toBe(400);
    expect((await client.json('GET', '/api/me')).status).toBe(401);
  });

  it('uploads, serves and removes the logo (PNG/JPG, max 2 MB)', async () => {
    const client = new Client(env);
    await client.loginByPhone('+48600000005');
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

    const wrongType = await client.request('PUT', '/api/company/logo', png, { 'Content-Type': 'image/gif' });
    expect(wrongType.status).toBe(415);
    const tooBig = await client.request('PUT', '/api/company/logo', new Uint8Array(2 * 1024 * 1024 + 1), {
      'Content-Type': 'image/png',
    });
    expect(tooBig.status).toBe(413);

    const up = await client.request('PUT', '/api/company/logo', png, { 'Content-Type': 'image/png' });
    expect(up.status).toBe(200);
    expect(((await up.json()) as MeResponse).company.hasLogo).toBe(true);

    const get = await client.request('GET', '/api/company/logo');
    expect(get.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(png);

    const del = await client.json<MeResponse>('DELETE', '/api/company/logo');
    expect(del.body.company.hasLogo).toBe(false);
    expect((await client.request('GET', '/api/company/logo')).status).toBe(404);
  });
});
