import { describe, expect, it } from 'vitest';
import {
  formatPercent,
  formatPLN,
  formatQty,
  parsePLN,
  percentOf,
  roundHalfUp,
  toQtyMilli,
  unitLabel,
  vatLabel,
} from '../src/money';
import { NBSP } from './helpers';

describe('roundHalfUp (BigInt division, half away from zero)', () => {
  it.each([
    [5n, 2n, 3n],
    [4n, 2n, 2n],
    [7n, 3n, 2n],
    [8n, 3n, 3n],
    [-5n, 2n, -3n],
    [-7n, 3n, -2n],
    [0n, 7n, 0n],
  ])('%s / %s = %s', (n, d, expected) => {
    expect(roundHalfUp(n, d)).toBe(expected);
  });

  it('rejects a non-positive denominator', () => {
    expect(() => roundHalfUp(1n, 0n)).toThrow(RangeError);
    expect(() => roundHalfUp(1n, -2n)).toThrow(RangeError);
  });

  it('handles products above Number.MAX_SAFE_INTEGER exactly', () => {
    const big = BigInt(Number.MAX_SAFE_INTEGER) * 1000n + 500n;
    expect(roundHalfUp(big, 1000n)).toBe(BigInt(Number.MAX_SAFE_INTEGER) + 1n);
  });
});

describe('percentOf', () => {
  it('computes VAT 8% of 8 270,00 zł', () => {
    expect(percentOf(827000, 800)).toBe(66160);
  });
  it('rounds half up to the grosz', () => {
    expect(percentOf(5, 1000)).toBe(1); // 0,5 gr → 1 gr
    expect(percentOf(4, 1000)).toBe(0);
  });
});

describe('formatPLN', () => {
  it('uses non-breaking spaces, comma decimals and „zł”', () => {
    expect(formatPLN(893160)).toBe(`8${NBSP}931,60${NBSP}zł`);
  });
  it.each([
    [0, '0,00 zł'],
    [5, '0,05 zł'],
    [42500, '425,00 zł'],
    [136800, '1 368,00 zł'],
    [123456789, '1 234 567,89 zł'],
    [-5000, '-50,00 zł'],
  ])('%i gr → %s', (gr, expected) => {
    expect(formatPLN(gr).replaceAll(NBSP, ' ')).toBe(expected);
  });
  it('rejects non-integer amounts', () => {
    expect(() => formatPLN(10.5)).toThrow(TypeError);
  });
});

describe('formatQty', () => {
  it.each([
    [30400, 'm2', '30,4 m²'],
    [6000, 'm2', '6,0 m²'],
    [10000, 'mb', '10,0 mb'],
    [1000, 'kpl', '1 kpl'],
    [3000, 'szt', '3 szt.'],
    [1500, 'h', '1,5 h'],
    [2000, 'h', '2 h'],
    [1250, 'szt', '1,25 szt.'],
    [1234567, 'm2', '1 234,6 m²'],
    [-1500, 'h', '-1,5 h'],
  ] as const)('%i %s → %s', (milli, unit, expected) => {
    expect(formatQty(milli, unit).replaceAll(NBSP, ' ')).toBe(expected);
  });
});

describe('labels', () => {
  it('unit labels', () => {
    expect(['m2', 'mb', 'szt', 'kpl', 'h'].map((u) => unitLabel(u as never))).toEqual([
      'm²',
      'mb',
      'szt.',
      'kpl',
      'h',
    ]);
  });
  it('percent and VAT labels', () => {
    expect(formatPercent(2000)).toBe('20%');
    expect(formatPercent(550)).toBe('5,5%');
    expect(vatLabel(800)).toBe('8%');
    expect(vatLabel(2300)).toBe('23%');
    expect(vatLabel(null)).toBe('zw.');
  });
});

describe('parsePLN (user input → grosze, no float math)', () => {
  it.each([
    ['900', 90000],
    ['900,5', 90050],
    ['900,50', 90050],
    ['900.05', 90005],
    [' 1 200,00 zł ', 120000],
    [`1${NBSP}200`, 120000],
    ['0', 0],
  ])('%j → %i', (text, gr) => {
    expect(parsePLN(text)).toBe(gr);
  });
  it.each(['', 'abc', '1,234', '-5', '12,3,4', '1e3'])('%j → null', (text) => {
    expect(parsePLN(text)).toBeNull();
  });
});

describe('toQtyMilli', () => {
  it('converts model numbers to thousandths without float drift', () => {
    expect(toQtyMilli(2.35)).toBe(2350);
    expect(toQtyMilli(0.1 + 0.2)).toBe(300);
    expect(toQtyMilli(5)).toBe(5000);
  });
});
