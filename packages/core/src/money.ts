import type { Unit } from './schemas';

/**
 * Money is always an integer number of grosze; quantities are integer thousandths of a unit (qtyMilli);
 * percentages are basis points (bps). Products are computed in BigInt and rounded half away from zero.
 */

const NBSP = '\u00A0';

const groupFormatter = new Intl.NumberFormat('pl-PL', { useGrouping: 'always', maximumFractionDigits: 0 });

/** n / d rounded half away from zero. `d` must be positive. */
export function roundHalfUp(n: bigint, d: bigint): bigint {
  if (d <= 0n) throw new RangeError('Denominator must be positive');
  const negative = n < 0n;
  const abs = negative ? -n : n;
  const q = (abs * 2n + d) / (2n * d);
  return negative ? -q : q;
}

/** `amountGr × bps / 10000`, rounded half up to the grosz. */
export function percentOf(amountGr: number, bps: number): number {
  return Number(roundHalfUp(BigInt(amountGr) * BigInt(bps), 10_000n));
}

/** Converts a decimal number from the model or a form to thousandths (e.g. 2,35 → 2350). */
export function toQtyMilli(value: number): number {
  return Math.round(value * 1000);
}

function groupDigits(n: bigint): string {
  return groupFormatter.format(n);
}

/** 893160 → „8 931,60 zł” (non-breaking spaces). */
export function formatPLN(gr: number): string {
  if (!Number.isInteger(gr)) throw new TypeError(`Amount must be integer grosze, got ${gr}`);
  const sign = gr < 0 ? '-' : '';
  const abs = BigInt(Math.abs(gr));
  const zl = abs / 100n;
  const cents = (abs % 100n).toString().padStart(2, '0');
  return `${sign}${groupDigits(zl)},${cents}${NBSP}zł`;
}

const UNIT_LABELS: Record<Unit, string> = { m2: 'm²', mb: 'mb', szt: 'szt.', kpl: 'kpl', h: 'h' };

export function unitLabel(unit: Unit): string {
  return UNIT_LABELS[unit];
}

/** Thousandths → decimal string with a comma, trailing zeros trimmed (1 ≤ maxDecimals ≤ 3). */
function formatMilli(milli: number, minDecimals: number, maxDecimals: number): string {
  const scale = 10n ** BigInt(3 - maxDecimals);
  const scaled = roundHalfUp(BigInt(milli), scale); // in units of 10^-maxDecimals
  const base = 10n ** BigInt(maxDecimals);
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;
  let frac = (abs % base).toString().padStart(maxDecimals, '0');
  while (frac.length > minDecimals && frac.endsWith('0')) frac = frac.slice(0, -1);
  const int = groupDigits(abs / base);
  return `${negative ? '-' : ''}${int}${frac ? `,${frac}` : ''}`;
}

/** 30400 m2 → „30,4 m²”; 1000 kpl → „1 kpl”; 1500 h → „1,5 h”. */
export function formatQty(qtyMilli: number, unit: Unit): string {
  const number = unit === 'm2' || unit === 'mb' ? formatMilli(qtyMilli, 1, 1) : formatMilli(qtyMilli, 0, 3);
  return `${number}${NBSP}${unitLabel(unit)}`;
}

/** 2000 → „20%”, 550 → „5,5%”. */
export function formatPercent(bps: number): string {
  return `${formatMilli(bps * 10, 0, 2)}%`;
}

/** VAT label for totals: „8%”, „23%” or „zw.” (exempt). */
export function vatLabel(vatBps: number | null): string {
  return vatBps === null ? 'zw.' : formatPercent(vatBps);
}

/**
 * Parses a price typed by the user („900”, „900,50”, „1 200 zł”) into grosze, without float math.
 * Returns null for anything that is not a non-negative amount with at most 2 decimals.
 */
export function parsePLN(text: string): number | null {
  const cleaned = text.replace(/zł/gi, '').replace(/\s/g, '');
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const zl = match[1]!;
  const cents = (match[2] ?? '').padEnd(2, '0');
  return Number(BigInt(zl) * 100n + BigInt(cents));
}
