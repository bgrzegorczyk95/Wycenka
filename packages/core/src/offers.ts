import { z } from 'zod';
import type { RoomGeometry } from './geometry';
import type { PricedItem, PricingWarning } from './pricing';
import { type AiQuestion, Unit } from './schemas';

/** Offers API shared by the worker and the web app (docs/06 „Oferty”). */

export const OFFER_STATUSES = [
  'draft',
  'queued',
  'processing',
  'ready',
  'sent',
  'opened',
  'accepted',
  'rejected',
  'expired',
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

/** Labels from docs/01 „Statusy oferty”. */
export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  draft: 'Szkic',
  queued: 'Szkic (czeka na wysłanie)',
  processing: 'Szkic (AI układa)',
  ready: 'Szkic',
  sent: 'Wysłana',
  opened: 'Otwarta',
  accepted: 'Zaakceptowana',
  rejected: 'Odrzucona',
  expired: 'Wygasła',
};

/** After sending the offer is read-only (MVP); the client can see it. */
export const isSentStatus = (s: OfferStatus) =>
  s === 'sent' || s === 'opened' || s === 'accepted' || s === 'rejected' || s === 'expired';

export type SendChannel = 'sms' | 'whatsapp' | 'email' | 'link';

export interface OfferListItem {
  id: string;
  title: string;
  status: OfferStatus;
  clientName: string | null;
  clientAddress: string | null;
  grossGr: number | null;
  missingPriceCount: number;
  updatedAt: number;
}

export interface OfferTotals {
  itemsSubtotalGr: number;
  discountGr: number;
  netGr: number;
  vatBps: number | null;
  vatGr: number;
  grossGr: number;
  missingPriceCount: number;
  canSend: boolean;
}

export interface OfferEvent {
  type: string;
  channel: string | null;
  createdAt: number;
  payload: Record<string, unknown> | null;
}

export interface OfferDetail {
  id: string;
  number: string | null;
  title: string;
  status: OfferStatus;
  link: string;
  client: { name: string; phone: string | null; email: string | null; address: string | null } | null;
  material: 'client' | 'contractor';
  validUntil: string | null;
  depositBps: number | null;
  startText: string | null;
  notesForClient: string | null;
  vatBps: number | null;
  discountBps: number | null;
  discountGr: number | null;
  transcript: string | null;
  recordingMs: number | null;
  processingStep: 'uploaded' | 'transcribed' | 'matched' | 'priced' | null;
  processingError: string | null;
  geometry: RoomGeometry[];
  items: PricedItem[];
  questions: (AiQuestion & { answer: string | null })[];
  warnings: PricingWarning[];
  totals: OfferTotals;
  sendChannel: SendChannel | null;
  sentAt: number | null;
  openedAt: number | null;
  acceptedAt: number | null;
  createdAt: number;
  events: OfferEvent[];
}

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const optionalText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable()).optional();

export const CreateOfferInput = z.object({
  /** Idempotency key generated on the phone. */
  clientUuid: z.uuid(),
  client: z.object({
    name: z.string().trim().min(2, 'Wpisz imię i nazwisko klienta.').max(120),
    phone: optionalText(30),
    address: optionalText(200),
  }),
  title: optionalText(60),
});
export type CreateOfferInput = z.input<typeof CreateOfferInput>;

export const OfferPatch = z.object({
  title: z.string().trim().min(2, 'Wpisz tytuł oferty.').max(60).optional(),
  material: z.enum(['client', 'contractor']).optional(),
  vatBps: z.union([z.literal(800), z.literal(2300), z.null()]).optional(),
  discountBps: z.number().int().min(0).max(10_000).nullable().optional(),
  discountGr: z.number().int().min(0).nullable().optional(),
  validUntil: z.iso.date('Wybierz datę ważności.').nullable().optional(),
  depositBps: z.number().int().min(0).max(10_000).nullable().optional(),
  startText: optionalText(120),
  notesForClient: optionalText(1000),
});
export type OfferPatch = z.input<typeof OfferPatch>;

export const AnswersInput = z.object({ answers: z.record(z.string(), z.string().trim().min(1).max(60)) });

export const GeometryInput = z.object({
  rooms: z.array(
    z.object({
      id: z.string(),
      lengthM: z.number().positive().max(100).nullable(),
      widthM: z.number().positive().max(100).nullable(),
      heightM: z.number().positive().max(20).nullable(),
    }),
  ),
});
export type GeometryInput = z.input<typeof GeometryInput>;

export const AddOfferItemInput = z.object({
  priceListItemId: z.string().nullable(),
  name: z.string().trim().min(2, 'Wpisz nazwę pozycji.').max(120),
  unit: Unit,
  qtyMilli: z.number().int().positive('Ilość musi być większa od zera.').max(100_000_000),
  /** null = no price yet („Brak w cenniku”); omitted = price from the price list. */
  unitPriceGr: z.number().int().nonnegative().nullable().optional(),
});
export type AddOfferItemInput = z.input<typeof AddOfferItemInput>;

export const OfferItemPatch = z.object({
  name: z.string().trim().min(2, 'Wpisz nazwę pozycji.').max(120).optional(),
  qtyMilli: z.number().int().nonnegative().max(100_000_000).optional(),
  unitPriceGr: z.number().int().nonnegative().nullable().optional(),
  /** „Zapisz w cenniku” for an item that was missing from the price list. */
  saveToPriceList: z.boolean().optional(),
});
export type OfferItemPatch = z.input<typeof OfferItemPatch>;

export const SendInput = z.object({ channel: z.enum(['sms', 'whatsapp', 'email', 'link']) });

export interface SendResponse {
  offer: OfferDetail;
  link: string;
}

/** „Dzień dobry, przesyłam ofertę na remont łazienki: {link}. Pozdrawiam, Marek Nowak” (fixture sendStep). */
export function offerMessage(title: string, link: string, signature: string): string {
  const what = title.charAt(0).toLowerCase() + title.slice(1);
  const sign = signature.trim() ? ` Pozdrawiam, ${signature.trim()}` : '';
  return `Dzień dobry, przesyłam ofertę na ${what}: ${link}.${sign}`;
}

/** Deep link that opens the contractor's own app with the message (offers are never sent from the server). */
export function sendDeepLink(
  channel: SendChannel,
  message: string,
  to: { phone: string | null; email: string | null },
  subject: string,
): string | null {
  const text = encodeURIComponent(message);
  const digits = to.phone?.replace(/\D/g, '') ?? '';
  switch (channel) {
    case 'sms':
      return digits ? `sms:+${digits}?&body=${text}` : null;
    case 'whatsapp':
      return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
    case 'email':
      return `mailto:${to.email ? encodeURIComponent(to.email) : ''}?subject=${encodeURIComponent(subject)}&body=${text}`;
    case 'link':
      return null;
  }
}
