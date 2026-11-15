import { describe, expect, it } from 'vitest';
import { addDays, formatDatePl, formatDateTimePl, formatDayMonthPl, warsawDate } from '../src/dates';
import {
  CreateOfferInput,
  OFFER_STATUS_LABELS,
  OfferPatch,
  isSentStatus,
  offerMessage,
  sendDeepLink,
} from '../src/offers';

describe('dates (Europe/Warsaw)', () => {
  it('calendar day in Warsaw', () => {
    expect(warsawDate(Date.UTC(2026, 10, 12, 23, 30))).toBe('2026-11-13');
    expect(warsawDate(Date.UTC(2026, 10, 13, 10, 0))).toBe('2026-11-13');
  });
  it('adds days across months and years', () => {
    expect(addDays('2026-11-13', 14)).toBe('2026-11-27');
    expect(addDays('2026-12-25', 14)).toBe('2027-01-08');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
  it('formats Polish dates', () => {
    expect(formatDatePl('2026-11-27')).toBe('27.11.2026');
    expect(formatDateTimePl(Date.UTC(2026, 10, 13, 18, 42))).toBe('13.11.2026, 19:42');
    expect(formatDayMonthPl(Date.UTC(2026, 10, 13, 10))).toBe('13 listopada');
    expect(formatDayMonthPl(Date.UTC(2026, 0, 2, 10))).toBe('2 stycznia');
  });
});

describe('offers', () => {
  it('status labels and sent statuses (docs/01)', () => {
    expect(OFFER_STATUS_LABELS.opened).toBe('Otwarta');
    expect(OFFER_STATUS_LABELS.ready).toBe('Szkic');
    expect(isSentStatus('ready')).toBe(false);
    expect(isSentStatus('opened')).toBe(true);
  });

  it('message from the fixture sendStep template', () => {
    expect(offerMessage('Remont łazienki', 'wycenka.pl/o/x7k2p9', 'Marek Nowak')).toBe(
      'Dzień dobry, przesyłam ofertę na remont łazienki: wycenka.pl/o/x7k2p9. Pozdrawiam, Marek Nowak',
    );
    expect(offerMessage('Łazienka', 'L', ' ')).toBe('Dzień dobry, przesyłam ofertę na łazienka: L.');
  });

  it('deep links open the contractor’s own apps', () => {
    const to = { phone: '+48600000000', email: 'anna@example.com' };
    expect(sendDeepLink('sms', 'a b', to, 'S')).toBe('sms:+48600000000?&body=a%20b');
    expect(sendDeepLink('whatsapp', 'a', to, 'S')).toBe('https://wa.me/48600000000?text=a');
    expect(sendDeepLink('whatsapp', 'a', { phone: null, email: null }, 'S')).toBe('https://wa.me/?text=a');
    expect(sendDeepLink('email', 'a', to, 'Oferta')).toBe('mailto:anna%40example.com?subject=Oferta&body=a');
    expect(sendDeepLink('email', 'a', { phone: null, email: null }, 'O')).toBe('mailto:?subject=O&body=a');
    expect(sendDeepLink('sms', 'a', { phone: null, email: null }, 'S')).toBeNull();
    // Numbers typed without the country code get +48
    expect(sendDeepLink('sms', 'a', { phone: '600 111 222', email: null }, 'S')).toBe(
      'sms:+48600111222?&body=a',
    );
    expect(sendDeepLink('whatsapp', 'a', { phone: '+49 151 1234567', email: null }, 'S')).toBe(
      'https://wa.me/491511234567?text=a',
    );
    expect(sendDeepLink('link', 'a', to, 'S')).toBeNull();
  });

  it('validates input', () => {
    const ok = CreateOfferInput.parse({
      clientUuid: '0b8a2c8e-6f0a-4c5e-9a39-2a8f7d1c9e11',
      client: { name: ' Anna Kowalska ', phone: '', address: 'ul. Puławska 1, Mokotów' },
    });
    expect(ok.client).toEqual({ name: 'Anna Kowalska', phone: null, address: 'ul. Puławska 1, Mokotów' });
    expect(CreateOfferInput.safeParse({ clientUuid: 'x', client: { name: 'A' } }).success).toBe(false);
    expect(OfferPatch.parse({ validUntil: '2026-11-27', notesForClient: '' })).toEqual({
      validUntil: '2026-11-27',
      notesForClient: null,
    });
    expect(OfferPatch.safeParse({ vatBps: 500 }).success).toBe(false);
  });
});
