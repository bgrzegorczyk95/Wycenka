import fixture from '../../../docs/fixtures/lazienka-kowalska.json';
import type { PriceOfferInput } from '../src/pricing';
import type { Extraction, ExtractionItem, ExtractionRoom, PriceListItem, PricingRule } from '../src/schemas';

export { fixture };

export const NBSP = ' ';

/** Fixture strings use regular spaces; the app formats with non-breaking spaces. */
export const plain = (s: string): string => s.replaceAll(NBSP, ' ');

export const priceList: PriceListItem[] = fixture.priceListAtOfferTime.map((p) => ({
  ...p,
  unit: p.unit as PriceListItem['unit'],
  measure: p.measure as PriceListItem['measure'],
}));

export const rules = fixture.rules as PricingRule[];

export const step1 = fixture.step1_extraction as Extraction;

/** Step 2 = step 1 + the item from the answer to q1; questions resolved. */
export const step2: Extraction = {
  ...step1,
  items: [...step1.items, fixture.step2_extraction_after_answer.addedItem as ExtractionItem],
  questions: [],
};

export function room(
  lengthM: number | null,
  widthM: number | null,
  heightM: number | null,
  openings: ExtractionRoom['openings'] = null,
  id = 'r1',
): ExtractionRoom {
  return { id, name: 'Pokój', lengthM, widthM, heightM, openings };
}

export function item(overrides: Partial<ExtractionItem>): ExtractionItem {
  return {
    priceListItemId: null,
    proposedName: null,
    roomId: 'r1',
    scope: 'count',
    count: null,
    manualQty: null,
    tileHeightM: null,
    mosaic: false,
    quote: '',
    fromAnswerTo: null,
    ...overrides,
  };
}

export function extraction(overrides: Partial<Extraction>): Extraction {
  return {
    title: 'Test',
    rooms: [room(3, 2, 2.6)],
    items: [],
    material: 'client',
    outOfTown: null,
    questions: [],
    ...overrides,
  };
}

/** Default engine input: fixture price list and rules, VAT 8%, no transcript check. */
export function input(overrides: Partial<PriceOfferInput>): PriceOfferInput {
  return {
    extraction: extraction({}),
    answers: {},
    priceList,
    rules,
    overrides: [],
    vatBps: 800,
    discount: null,
    ...overrides,
  };
}
