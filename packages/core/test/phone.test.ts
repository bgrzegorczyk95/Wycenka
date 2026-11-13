import { describe, expect, it } from 'vitest';
import { formatPlPhone, maskPhone, normalizePlPhone } from '../src/phone';

describe('Polish phone numbers', () => {
  it.each([
    ['600000000', '+48600000000'],
    ['600 000 000', '+48600000000'],
    ['600-000-000', '+48600000000'],
    ['+48 600 000 000', '+48600000000'],
    ['0048600000000', '+48600000000'],
    ['48600000000', '+48600000000'],
  ])('%j → %s', (input, e164) => {
    expect(normalizePlPhone(input)).toBe(e164);
  });

  it.each(['', '60000000', '6000000000', '+49600000000', 'abc', '+48 600 000 00a'])('rejects %j', (input) => {
    expect(normalizePlPhone(input)).toBeNull();
  });

  it('formats for display', () => {
    expect(formatPlPhone('+48600000000')).toBe('600 000 000');
    expect(formatPlPhone('something else')).toBe('something else');
  });

  it('masks for logs (RODO)', () => {
    expect(maskPhone('+48600123456')).toBe('+48•••••3456');
  });
});
