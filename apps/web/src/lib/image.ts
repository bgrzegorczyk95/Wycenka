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

const PHOTO_MAX_SIDE = 1600;

/**
 * Visit photo for the offer (docs/02): scaled to max 1600 px, JPEG 0,8, upright. Re-encoding through a
 * canvas drops EXIF – including the GPS location of the client's home.
 */
export async function compressPhoto(file: File): Promise<ArrayBuffer> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.8),
  );
  return blob.arrayBuffer();
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
