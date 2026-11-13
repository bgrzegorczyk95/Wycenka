import {
  areaQtyMilli,
  computeRoomGeometry,
  lengthQtyMilli,
  metersToMm,
  roundQtyMilli,
  wallAreaMm2,
  type RoomGeometry,
} from './geometry';
import { percentOf, roundHalfUp, toQtyMilli } from './money';
import type {
  AiQuestion,
  Discount,
  Extraction,
  ExtractionItem,
  OfferItemOverride,
  PriceListItem,
  PricingRule,
  PricingRuleKind,
  Scope,
  Unit,
} from './schemas';

/**
 * Deterministic pricing engine (docs/05-ai-i-wycena.md §3). Pure function, no I/O.
 * The AI only supplies structure; every quantity and amount is computed here.
 */

export interface PriceOfferInput {
  extraction: Extraction;
  /** Answers to AI questions, by question id. */
  answers: Record<string, string>;
  /** Price list with prices, in display order (sortOrder). */
  priceList: PriceListItem[];
  rules: PricingRule[];
  /** Locked user changes – never overwritten by re-pricing. */
  overrides: OfferItemOverride[];
  /** null = VAT exempt („zw.”). */
  vatBps: number | null;
  discount: Discount | null;
  /** When given, every transcript quote is checked against it („sprawdź źródło”). */
  transcript?: string;
}

export type SourceKind = 'transcript' | 'ai_answer' | 'manual' | 'rule';

export interface PricedItem {
  /** Stable id of the item across re-pricing; overrides refer to it. */
  key: string;
  priceListItemId: string | null;
  name: string;
  unit: Unit;
  qtyMilli: number;
  /** Copy of the price-list price (or the user's price); null = „Brak w cenniku”. */
  unitPriceGr: number | null;
  surchargeBps: number;
  valueGr: number | null;
  scope: Scope | null;
  roomId: string | null;
  sourceKind: SourceKind;
  sourceQuote: string | null;
  sourceQuestionId: string | null;
  locked: boolean;
  missingPrice: boolean;
}

export type WarningCode =
  | 'unknown_price_list_item'
  | 'unit_scope_mismatch'
  | 'manual_qty_missing'
  | 'missing_room'
  | 'missing_dimensions'
  | 'room_dimension_out_of_range'
  | 'room_height_out_of_range'
  | 'quantity_check'
  | 'quote_not_found';

export interface PricingWarning {
  code: WarningCode;
  /** Polish, ready to show next to the item or room. */
  message: string;
  itemKey?: string;
  roomId?: string;
}

export interface PriceOfferResult {
  geometry: RoomGeometry[];
  items: PricedItem[];
  /** Sum of priced items, before rule items and discount. */
  itemsSubtotalGr: number;
  discountGr: number;
  netGr: number;
  vatBps: number | null;
  vatGr: number;
  grossGr: number;
  missingPriceCount: number;
  /** Sending is blocked while any item has no price. */
  canSend: boolean;
  questions: (AiQuestion & { answer: string | null })[];
  warnings: PricingWarning[];
}

export const TRAVEL_FEE_NAME = 'Dojazd poza miasto';
export const MIN_ORDER_NAME = 'Dopłata do minimalnej kwoty zlecenia';
export const UNNAMED_ITEM_NAME = 'Pozycja spoza cennika';

const WALLS_FLOOR_SUFFIX = ' (ściany + podłoga)';

const ROOM_SIDE_MM = { min: 500, max: 30_000 };
const ROOM_HEIGHT_MM = { min: 2_000, max: 5_000 };
const MAX_AREA_MILLI = 500_000; // 500 m²
const MAX_COUNT_MILLI = 50_000; // 50 szt./kpl

/** value = qty × price × (1 + surcharge), BigInt, rounded half up to the grosz. */
export function itemValueGr(qtyMilli: number, unitPriceGr: number, surchargeBps: number): number {
  const numerator = BigInt(qtyMilli) * BigInt(unitPriceGr) * BigInt(10_000 + surchargeBps);
  return Number(roundHalfUp(numerator, 1000n * 10_000n));
}

/** Lowercase, no Polish diacritics, no punctuation, single spaces. */
export function normalizeForQuote(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const AREA_SCOPES: readonly Scope[] = ['walls', 'floor', 'walls_floor', 'ceiling'];

function unitFitsScope(unit: Unit, scope: Scope): boolean {
  if (scope === 'manual') return true;
  if (unit === 'm2') return AREA_SCOPES.includes(scope);
  if (unit === 'mb') return scope === 'perimeter';
  return scope === 'count';
}

function defaultUnitForScope(scope: Scope): Unit {
  if (AREA_SCOPES.includes(scope)) return 'm2';
  if (scope === 'perimeter') return 'mb';
  return 'kpl';
}

function activeRule(rules: PricingRule[], kind: PricingRuleKind): PricingRule | undefined {
  return rules.find((r) => r.kind === kind && r.enabled);
}

interface Draft extends PricedItem {
  /** Sort keys. */
  roomOrder: number;
  priceListOrder: number;
  inputOrder: number;
}

interface Context {
  input: PriceOfferInput;
  rooms: Map<string, { order: number; geometry: RoomGeometry }>;
  priceIndex: Map<string, number>;
  warnings: PricingWarning[];
}

export function priceOffer(input: PriceOfferInput): PriceOfferResult {
  const { extraction } = input;
  const geometry = extraction.rooms.map(computeRoomGeometry);
  const ctx: Context = {
    input,
    rooms: new Map(geometry.map((g, order) => [g.roomId, { order, geometry: g }])),
    priceIndex: new Map(input.priceList.map((p, i) => [p.id, i])),
    warnings: [],
  };

  const roomWarnings = geometry.flatMap(validateRoom);

  // 1. Items from the extraction, with locked user edits applied.
  const edits = new Map<string, Extract<OfferItemOverride, { kind: 'edit' }>>();
  const removed = new Set<string>();
  for (const o of input.overrides) {
    if (o.kind === 'edit') edits.set(o.key, o);
    if (o.kind === 'remove') removed.add(o.key);
  }

  const usedKeys = new Map<string, number>();
  const drafts: Draft[] = [];
  extraction.items.forEach((item, inputOrder) => {
    const draft = draftFromExtraction(ctx, item, inputOrder, usedKeys);
    if (removed.has(draft.key)) return;
    const edit = edits.get(draft.key);
    if (edit) applyEdit(draft, edit);
    drafts.push(draft);
  });

  // 2. Items added by hand.
  input.overrides.forEach((o, i) => {
    if (o.kind === 'add') drafts.push(draftFromAdd(ctx, o, extraction.items.length + i));
  });

  // 3. Order: room, then price-list order (items outside the price list last), then input order.
  drafts.sort(
    (a, b) => a.roomOrder - b.roomOrder || a.priceListOrder - b.priceListOrder || a.inputOrder - b.inputOrder,
  );

  // 4. Values.
  for (const d of drafts) {
    d.missingPrice = d.unitPriceGr === null;
    d.valueGr = d.unitPriceGr === null ? null : itemValueGr(d.qtyMilli, d.unitPriceGr, d.surchargeBps);
  }
  const items: PricedItem[] = drafts.map(toPricedItem);

  for (const item of items) checkQuantity(ctx, item);

  const itemsSubtotalGr = items.reduce((sum, i) => sum + (i.valueGr ?? 0), 0);

  // 5. Rule items: travel fee, then the minimum order top-up (compared with items only).
  const travel = activeRule(input.rules, 'travel_fee');
  if (extraction.outOfTown === true && travel?.amountGr) {
    items.push(ruleItem('travel_fee', travel.label ?? TRAVEL_FEE_NAME, travel.amountGr));
  }
  const minOrder = activeRule(input.rules, 'min_order');
  if (minOrder?.amountGr && itemsSubtotalGr > 0 && itemsSubtotalGr < minOrder.amountGr) {
    items.push(ruleItem('min_order', MIN_ORDER_NAME, minOrder.amountGr - itemsSubtotalGr));
  }

  // 6. Totals.
  const beforeDiscountGr = items.reduce((sum, i) => sum + (i.valueGr ?? 0), 0);
  const discountGr = computeDiscount(beforeDiscountGr, input.discount);
  const netGr = beforeDiscountGr - discountGr;
  const vatGr = input.vatBps === null ? 0 : percentOf(netGr, input.vatBps);
  const missingPriceCount = items.filter((i) => i.missingPrice).length;
  const pricedCount = items.filter((i) => i.sourceKind !== 'rule' && !i.missingPrice).length;

  return {
    geometry,
    items,
    itemsSubtotalGr,
    discountGr,
    netGr,
    vatBps: input.vatBps,
    vatGr,
    grossGr: netGr + vatGr,
    missingPriceCount,
    canSend: missingPriceCount === 0 && pricedCount > 0,
    questions: extraction.questions.map((q) => ({ ...q, answer: input.answers[q.id] ?? null })),
    warnings: [...roomWarnings, ...sortByItemOrder(ctx.warnings, items)],
  };
}

/**
 * Item warnings follow the order of items on the offer (stable for equal positions).
 * Warnings of items the user removed are dropped.
 */
function sortByItemOrder(warnings: PricingWarning[], items: PricedItem[]): PricingWarning[] {
  const position = new Map(items.map((item, i) => [item.key, i]));
  return warnings
    .filter((w) => position.has(w.itemKey!))
    .sort((a, b) => position.get(a.itemKey!)! - position.get(b.itemKey!)!);
}

function itemKey(
  item: ExtractionItem,
  known: PriceListItem | undefined,
  usedKeys: Map<string, number>,
): string {
  const what = known ? known.id : `new:${normalizeForQuote(item.proposedName ?? '').replace(/ /g, '-')}`;
  const base = `${what}@${item.roomId ?? '-'}:${item.scope}`;
  const n = (usedKeys.get(base) ?? 0) + 1;
  usedKeys.set(base, n);
  return n === 1 ? base : `${base}#${n}`;
}

function roomOrder(ctx: Context, roomId: string | null): number {
  const room = roomId === null ? undefined : ctx.rooms.get(roomId);
  if (room) return room.order;
  // Without a (known) room: with one room it belongs there, otherwise after all rooms.
  return ctx.rooms.size === 1 ? 0 : ctx.rooms.size;
}

function resolveRoom(ctx: Context, roomId: string | null): RoomGeometry | undefined {
  if (roomId !== null) return ctx.rooms.get(roomId)?.geometry;
  if (ctx.rooms.size === 1) return [...ctx.rooms.values()][0]!.geometry;
  return undefined;
}

function draftFromExtraction(
  ctx: Context,
  item: ExtractionItem,
  inputOrder: number,
  usedKeys: Map<string, number>,
): Draft {
  const known =
    item.priceListItemId === null
      ? undefined
      : ctx.input.priceList.find((p) => p.id === item.priceListItemId);
  const key = itemKey(item, known, usedKeys);

  if (item.priceListItemId !== null && !known) {
    ctx.warnings.push({
      code: 'unknown_price_list_item',
      message: 'AI wskazało pozycję, której nie ma w cenniku – wpisz cenę albo usuń pozycję.',
      itemKey: key,
    });
  }

  const unit = known ? known.unit : (item.manualQty?.unit ?? defaultUnitForScope(item.scope));
  const name = known
    ? (known.offerName ?? known.name) + (item.scope === 'walls_floor' ? WALLS_FLOOR_SUFFIX : '')
    : (item.proposedName ?? UNNAMED_ITEM_NAME);
  const room = resolveRoom(ctx, item.roomId);
  const fromAnswer = item.fromAnswerTo !== null;

  if (!fromAnswer && ctx.input.transcript !== undefined) {
    const quote = normalizeForQuote(item.quote);
    if (quote === '' || !normalizeForQuote(ctx.input.transcript).includes(quote)) {
      ctx.warnings.push({
        code: 'quote_not_found',
        message: 'Sprawdź źródło – tego fragmentu nie ma w nagraniu.',
        itemKey: key,
      });
    }
  }

  return {
    key,
    priceListItemId: known ? known.id : null,
    name,
    unit,
    qtyMilli: quantity(ctx, item, unit, room, key),
    unitPriceGr: known ? known.priceGr : null,
    surchargeBps: known ? surcharges(ctx, item, known, room) : 0,
    valueGr: null,
    scope: item.scope,
    roomId: item.roomId,
    sourceKind: fromAnswer ? 'ai_answer' : 'transcript',
    sourceQuote: fromAnswer ? null : item.quote,
    sourceQuestionId: item.fromAnswerTo,
    locked: false,
    missingPrice: false,
    roomOrder: roomOrder(ctx, item.roomId),
    priceListOrder: known ? ctx.priceIndex.get(known.id)! : Number.POSITIVE_INFINITY,
    inputOrder,
  };
}

function draftFromAdd(
  ctx: Context,
  add: Extract<OfferItemOverride, { kind: 'add' }>,
  inputOrder: number,
): Draft {
  const known =
    add.priceListItemId === null ? undefined : ctx.input.priceList.find((p) => p.id === add.priceListItemId);
  const unitPriceGr = add.unitPriceGr !== undefined ? add.unitPriceGr : (known?.priceGr ?? null);
  return {
    key: add.key,
    priceListItemId: known ? known.id : null,
    name: add.name,
    unit: add.unit,
    qtyMilli: add.qtyMilli,
    unitPriceGr,
    surchargeBps: 0,
    valueGr: null,
    scope: null,
    roomId: null,
    sourceKind: 'manual',
    sourceQuote: null,
    sourceQuestionId: null,
    locked: true,
    missingPrice: false,
    roomOrder: roomOrder(ctx, null),
    priceListOrder: known ? ctx.priceIndex.get(known.id)! : Number.POSITIVE_INFINITY,
    inputOrder,
  };
}

function applyEdit(draft: Draft, edit: Extract<OfferItemOverride, { kind: 'edit' }>): void {
  if (edit.name !== undefined) draft.name = edit.name;
  if (edit.qtyMilli !== undefined) draft.qtyMilli = edit.qtyMilli;
  if (edit.unitPriceGr !== undefined) draft.unitPriceGr = edit.unitPriceGr;
  draft.locked = true;
}

function toPricedItem(d: Draft): PricedItem {
  const { roomOrder: _r, priceListOrder: _p, inputOrder: _i, ...item } = d;
  return item;
}

function quantity(
  ctx: Context,
  item: ExtractionItem,
  unit: Unit,
  room: RoomGeometry | undefined,
  key: string,
): number {
  const ONE = 1000;
  const mismatch = (): number => {
    ctx.warnings.push({
      code: 'unit_scope_mismatch',
      message: 'Jednostka z cennika nie pasuje do zakresu prac – przyjęto ilość 1, sprawdź.',
      itemKey: key,
    });
    return ONE;
  };

  if (!unitFitsScope(unit, item.scope)) return mismatch();

  switch (item.scope) {
    case 'count':
      return (item.count ?? 1) * ONE;
    case 'manual':
      if (item.manualQty === null) {
        ctx.warnings.push({
          code: 'manual_qty_missing',
          message: 'Brak ilości – przyjęto 1, sprawdź.',
          itemKey: key,
        });
        return ONE;
      }
      if (item.manualQty.unit !== unit) return mismatch();
      return roundQtyMilli(toQtyMilli(item.manualQty.value), unit);
    default:
      return measuredQuantity(ctx, item, room, key);
  }
}

function measuredQuantity(
  ctx: Context,
  item: ExtractionItem,
  room: RoomGeometry | undefined,
  key: string,
): number {
  if (!room) {
    ctx.warnings.push({
      code: 'missing_room',
      message: 'Nie wiadomo, którego pomieszczenia dotyczy pozycja – wpisz ilość.',
      itemKey: key,
    });
    return 0;
  }

  const walls = (): number | null => {
    if (room.heightMm === null) return null;
    const h =
      item.tileHeightM === null ? room.heightMm : Math.min(metersToMm(item.tileHeightM), room.heightMm);
    const mm2 = wallAreaMm2(room, h);
    return mm2 === null ? null : areaQtyMilli(mm2);
  };

  let qty: number | null;
  switch (item.scope) {
    case 'walls':
      qty = walls();
      break;
    case 'walls_floor': {
      const w = walls();
      // A room with walls always has a floor.
      qty = w === null ? null : w + room.floorQtyMilli!;
      break;
    }
    case 'perimeter':
      qty = room.perimeterTrimMm === null ? null : lengthQtyMilli(room.perimeterTrimMm);
      break;
    default: // floor, ceiling
      qty = room.floorQtyMilli;
  }

  if (qty === null) {
    ctx.warnings.push({
      code: 'missing_dimensions',
      message: `Brak wymiarów pomieszczenia „${room.name}” – uzupełnij wymiary.`,
      itemKey: key,
      roomId: room.roomId,
    });
    return 0;
  }
  return qty;
}

function surcharges(
  ctx: Context,
  item: ExtractionItem,
  known: PriceListItem,
  room: RoomGeometry | undefined,
): number {
  const { rules, extraction } = ctx.input;
  let bps = 0;

  const mosaic = activeRule(rules, 'mosaic_surcharge');
  if (mosaic?.bps && item.mosaic && known.tags.includes('mosaic-eligible')) bps += mosaic.bps;

  const height = activeRule(rules, 'height_surcharge');
  if (
    height?.bps &&
    height.thresholdMilli != null &&
    room?.heightMm != null &&
    room.heightMm > height.thresholdMilli &&
    (item.scope === 'walls' || item.scope === 'walls_floor') &&
    known.tags.includes('wall')
  ) {
    bps += height.bps;
  }

  const markup = activeRule(rules, 'material_markup');
  if (markup?.bps && extraction.material === 'contractor' && known.tags.includes('material'))
    bps += markup.bps;

  return bps;
}

function ruleItem(kind: 'travel_fee' | 'min_order', name: string, amountGr: number): PricedItem {
  return {
    key: `rule:${kind}`,
    priceListItemId: null,
    name,
    unit: 'kpl',
    qtyMilli: 1000,
    unitPriceGr: amountGr,
    surchargeBps: 0,
    valueGr: amountGr,
    scope: null,
    roomId: null,
    sourceKind: 'rule',
    sourceQuote: null,
    sourceQuestionId: null,
    locked: false,
    missingPrice: false,
  };
}

function computeDiscount(baseGr: number, discount: Discount | null): number {
  if (!discount) return 0;
  const byPercent = discount.bps && discount.bps > 0 ? percentOf(baseGr, discount.bps) : 0;
  const byAmount = discount.gr && discount.gr > 0 ? discount.gr : 0;
  return Math.min(baseGr, byPercent + byAmount);
}

function validateRoom(room: RoomGeometry): PricingWarning[] {
  const warnings: PricingWarning[] = [];
  const sideOut = [room.lengthMm, room.widthMm].some(
    (mm) => mm !== null && (mm < ROOM_SIDE_MM.min || mm > ROOM_SIDE_MM.max),
  );
  if (sideOut) {
    warnings.push({
      code: 'room_dimension_out_of_range',
      message: `Sprawdź wymiary pomieszczenia „${room.name}” (poza zakresem 0,5–30 m).`,
      roomId: room.roomId,
    });
  }
  if (room.heightMm !== null && (room.heightMm < ROOM_HEIGHT_MM.min || room.heightMm > ROOM_HEIGHT_MM.max)) {
    warnings.push({
      code: 'room_height_out_of_range',
      message: `Sprawdź wysokość pomieszczenia „${room.name}” (poza zakresem 2,0–5,0 m).`,
      roomId: room.roomId,
    });
  }
  return warnings;
}

function checkQuantity(ctx: Context, item: PricedItem): void {
  const tooMuch =
    (item.unit === 'm2' && item.qtyMilli > MAX_AREA_MILLI) ||
    ((item.unit === 'szt' || item.unit === 'kpl') && item.qtyMilli > MAX_COUNT_MILLI);
  if (tooMuch) {
    ctx.warnings.push({ code: 'quantity_check', message: 'Sprawdź ilość.', itemKey: item.key });
  }
}
