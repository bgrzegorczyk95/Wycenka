import { formatQty, parsePLN } from '@wycenka/core';

/** A typed price that is not empty and cannot be parsed (e.g. „4,555” or „abc”). */
export const isInvalidPrice = (text: string) => text.trim() !== '' && parsePLN(text) === null;

/** „30,4” → 30400 (thousandths). Up to 3 decimals, no float math. */
export function parseQty(text: string): number | null {
  const match = /^(\d+)(?:[.,](\d{1,3}))?$/.exec(text.replace(/\s/g, ''));
  if (!match) return null;
  return Number(match[1]) * 1000 + Number((match[2] ?? '').padEnd(3, '0'));
}

/** 30400 → „30,4”, 1000 → „1”. */
export function qtyInputText(qtyMilli: number): string {
  const int = Math.trunc(qtyMilli / 1000);
  const frac = String(qtyMilli % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '');
  return frac ? `${int},${frac}` : String(int);
}

/** Millimetres → „3,0” (metres with one decimal), using the money/qty formatter without the unit. */
export const metres = (mm: number) => formatQty(mm, 'mb').replace(/\s*mb$/, '');
