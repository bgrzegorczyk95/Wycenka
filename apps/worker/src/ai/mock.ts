import type { Extraction, ExtractionItem, PriceListItem } from '@wycenka/core';
import fixture from '../../../../docs/fixtures/lazienka-kowalska.json';

/**
 * MOCK_AI=1: stands in for speech-to-text + LLM extraction (docs/07 M5) using the golden fixture.
 * Fixture price-list ids are mapped onto the contractor's own price list via template keys / names,
 * so prices still come only from their price list.
 */

export const MOCK_TRANSCRIPT = fixture.transcript;
export const MOCK_RECORDING_MS = fixture.recording.durationMs;

type SnapshotItem = PriceListItem & { templateKey?: string | null };

function resolveId(fixtureId: string, priceList: SnapshotItem[]): string | null {
  const fixtureItem = fixture.priceListAtOfferTime.find((p) => p.id === fixtureId);
  const match =
    priceList.find((p) => p.templateKey === `glazurnik.${fixtureId}`) ??
    priceList.find((p) => fixtureItem && p.name.toLowerCase() === fixtureItem.name.toLowerCase());
  return match?.id ?? null;
}

function mapItem(item: ExtractionItem, priceList: SnapshotItem[]): ExtractionItem {
  if (item.priceListItemId === null) return item;
  const id = resolveId(item.priceListItemId, priceList);
  if (id) return { ...item, priceListItemId: id };
  // Not in this contractor's price list → „Brak w cenniku” with the fixture name.
  const f = fixture.priceListAtOfferTime.find((p) => p.id === item.priceListItemId);
  return { ...item, priceListItemId: null, proposedName: f?.offerName ?? f?.name ?? 'Pozycja spoza cennika' };
}

export function mockExtraction(priceList: SnapshotItem[], answers: Record<string, string>): Extraction {
  const step1 = fixture.step1_extraction as Extraction;
  const answeredFloor = answers.q1?.toLowerCase() === 'tak';
  const items = answeredFloor
    ? [...step1.items, fixture.step2_extraction_after_answer.addedItem as ExtractionItem]
    : step1.items;
  return {
    ...step1,
    items: items.map((i) => mapItem(i, priceList)),
    // The question disappears once answered (either way).
    questions: answers.q1 ? [] : step1.questions,
  };
}
