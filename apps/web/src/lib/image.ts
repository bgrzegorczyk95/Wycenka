import type { MeResponse } from '@wycenka/core';

const LOGO_SIZE = 512;

/**
 * Crops an image to a centered square and scales it down to 512 px (docs/02: logo „przycinane do kwadratu”).
 * PNG stays PNG (transparency), everything else becomes JPEG 0,9.
 */
export async function squareLogo(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(side, LOGO_SIZE);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), type, 0.9),
  );
}

/** „Usługi Glazurnicze Nowak” → „UN” (first and last word). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0]![0] ?? '';
  const last = words.length > 1 ? (words.at(-1)![0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** URL of the company logo with a cache-busting version, or null. */
export function logoUrl(me: MeResponse): string | null {
  return me.company.hasLogo ? `/api/company/logo?v=${me.company.logoVersion}` : null;
}
