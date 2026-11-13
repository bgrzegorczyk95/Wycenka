import { z } from 'zod';

/** Units used in price lists and offers. Display labels: see `unitLabel` in money.ts. */
export const Unit = z.enum(['m2', 'mb', 'szt', 'kpl', 'h']);
export type Unit = z.infer<typeof Unit>;

/** How a quantity is derived from the room geometry (price list `measure` / extraction `scope`). */
export const Scope = z.enum(['walls', 'floor', 'walls_floor', 'ceiling', 'perimeter', 'count', 'manual']);
export type Scope = z.infer<typeof Scope>;

// ---------------------------------------------------------------------------
// AI extraction (docs/05-ai-i-wycena.md §2). The model returns structure only – never prices.
// ---------------------------------------------------------------------------

export const Opening = z.object({
  kind: z.enum(['door', 'window']),
  widthM: z.number(),
  heightM: z.number(),
});
export type Opening = z.infer<typeof Opening>;

export const ExtractionRoom = z.object({
  id: z.string(),
  name: z.string(),
  lengthM: z.number().nullable(),
  widthM: z.number().nullable(),
  heightM: z.number().nullable(),
  /** null = not mentioned → the engine assumes one door 0,8 × 2,0 m. */
  openings: z.array(Opening).nullable(),
});
export type ExtractionRoom = z.infer<typeof ExtractionRoom>;

export const ExtractionItem = z.object({
  /** null = not in the price list („Brak w cenniku”). */
  priceListItemId: z.string().nullable(),
  /** Required when priceListItemId is null. */
  proposedName: z.string().nullable(),
  roomId: z.string().nullable(),
  scope: Scope,
  count: z.number().int().positive().nullable(),
  manualQty: z.object({ value: z.number().positive(), unit: Unit }).nullable(),
  /** „płytki do wysokości 2 m”; null = up to the ceiling. */
  tileHeightM: z.number().nullable(),
  mosaic: z.boolean(),
  /** Verbatim fragment of the transcript. */
  quote: z.string(),
  /** Question id, when the item comes from an answer. */
  fromAnswerTo: z.string().nullable(),
});
export type ExtractionItem = z.infer<typeof ExtractionItem>;

export const AiQuestion = z.object({
  id: z.string(),
  text: z.string().max(80),
  kind: z.enum(['yes_no', 'number', 'choice']),
  options: z.array(z.string()).nullable(),
  unit: z.string().nullable(),
});
export type AiQuestion = z.infer<typeof AiQuestion>;

export const Extraction = z.object({
  title: z.string().max(60),
  rooms: z.array(ExtractionRoom),
  items: z.array(ExtractionItem),
  material: z.enum(['client', 'contractor', 'unknown']),
  outOfTown: z.boolean().nullable(),
  questions: z.array(AiQuestion).max(3),
});
export type Extraction = z.infer<typeof Extraction>;

// ---------------------------------------------------------------------------
// Price list and rules („Dopłaty i zasady”)
// ---------------------------------------------------------------------------

export const PriceListItem = z.object({
  id: z.string(),
  name: z.string(),
  /** Name on the offer when different, e.g. „Montaż stelaża podtynkowego WC”. */
  offerName: z.string().nullable(),
  unit: Unit,
  measure: Scope,
  /** Net price in grosze. */
  priceGr: z.number().int().nonnegative(),
  tags: z.array(z.string()),
  aliases: z.array(z.string()).optional(),
  category: z.string().optional(),
});
export type PriceListItem = z.infer<typeof PriceListItem>;

export const PricingRuleKind = z.enum([
  'mosaic_surcharge',
  'height_surcharge',
  'min_order',
  'travel_fee',
  'material_markup',
]);
export type PricingRuleKind = z.infer<typeof PricingRuleKind>;

export const PricingRule = z.object({
  kind: PricingRuleKind,
  label: z.string().optional(),
  /** Percent in basis points: +20% → 2000. */
  bps: z.number().int().nonnegative().nullable().optional(),
  /** Amount in grosze: 500 zł → 50000. */
  amountGr: z.number().int().nonnegative().nullable().optional(),
  /** Threshold in thousandths of a metre (= mm): 3 m → 3000. */
  thresholdMilli: z.number().int().nonnegative().nullable().optional(),
  enabled: z.boolean(),
});
export type PricingRule = z.infer<typeof PricingRule>;

// ---------------------------------------------------------------------------
// User changes to offer items (locked – never overwritten by re-pricing)
// ---------------------------------------------------------------------------

export const OfferItemOverride = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('edit'),
    key: z.string(),
    name: z.string().min(1).optional(),
    qtyMilli: z.number().int().nonnegative().optional(),
    /** null = clear the price (back to „Brak w cenniku”). */
    unitPriceGr: z.number().int().nonnegative().nullable().optional(),
  }),
  z.object({ kind: z.literal('remove'), key: z.string() }),
  z.object({
    kind: z.literal('add'),
    key: z.string(),
    priceListItemId: z.string().nullable(),
    name: z.string().min(1),
    unit: Unit,
    qtyMilli: z.number().int().nonnegative(),
    /** Omitted → price from the price list (when priceListItemId is set). */
    unitPriceGr: z.number().int().nonnegative().nullable().optional(),
  }),
]);
export type OfferItemOverride = z.infer<typeof OfferItemOverride>;

export const Discount = z.object({
  bps: z.number().int().optional(),
  gr: z.number().int().optional(),
});
export type Discount = z.infer<typeof Discount>;

// ---------------------------------------------------------------------------
// Price list import (docs/05-ai-i-wycena.md §4). Here the model does return prices:
// the contractor dictates their own price list.
// ---------------------------------------------------------------------------

export const PriceListCandidate = z.object({
  name: z.string(),
  unit: Unit,
  priceGr: z.number().int().nonnegative(),
  category: z.string().nullable(),
  matchedPriceListItemId: z.string().nullable(),
  quote: z.string(),
});
export type PriceListCandidate = z.infer<typeof PriceListCandidate>;

export const PriceListCandidates = z.array(PriceListCandidate);
