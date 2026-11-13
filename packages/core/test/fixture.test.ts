import { describe, expect, it } from 'vitest';
import { formatPLN } from '../src/money';
import { priceOffer, type PriceOfferInput, type PriceOfferResult } from '../src/pricing';
import { Extraction } from '../src/schemas';
import { fixture, plain, priceList, rules, step1, step2 } from './helpers';

const { expected } = fixture;

const base: PriceOfferInput = {
  extraction: step2,
  answers: fixture.answers,
  priceList,
  rules,
  overrides: [],
  vatBps: fixture.company.defaultVatBps,
  discount: null,
  transcript: fixture.transcript,
};

function brodzikKey(result: PriceOfferResult): string {
  const brodzik = result.items.find((i) => i.name === expected.afterUserSetsPrice.item);
  if (!brodzik) throw new Error('brodzik not found');
  return brodzik.key;
}

describe('golden example: Łazienka – Anna Kowalska', () => {
  it('fixture extractions are valid against the zod schema', () => {
    expect(Extraction.safeParse(step1).success).toBe(true);
    expect(Extraction.safeParse(step2).success).toBe(true);
  });

  it('computes room geometry 3,0 × 2,0 × 2,6 m with a default door', () => {
    const { geometry } = priceOffer(base);
    expect(geometry).toHaveLength(1);
    const g = geometry[0]!;
    const e = expected.geometry.r1;
    expect(g.roomId).toBe('r1');
    expect(g.perimeterMm).toBe(e.perimeterMilli);
    expect(g.wallsGrossMm2! / 1000).toBe(e.wallsGrossMilli);
    expect(g.openingsMm2! / 1000).toBe(e.openingsMilli);
    expect(g.wallsMm2! / 1000).toBe(e.wallsMilli);
    expect(g.floorMm2! / 1000).toBe(e.floorMilli);
    expect(g.wallsQtyMilli).toBe(e.wallsMilli);
    expect(g.floorQtyMilli).toBe(e.floorMilli);
    expect(g.assumedDefaultDoor).toBe(e.assumedDefaultDoor);
  });

  it('produces the expected items in order (before the brodzik price is filled in)', () => {
    const { items } = priceOffer(base);
    expect(
      items.map((i) => ({
        name: i.name,
        unit: i.unit,
        qtyMilli: i.qtyMilli,
        unitPriceGr: i.unitPriceGr,
        valueGr: i.valueGr,
        sourceKind: i.sourceKind,
        sourceQuote: i.sourceQuote,
      })),
    ).toEqual(
      expected.itemsInOrder.map((e) => ({
        name: e.name,
        unit: e.unit,
        qtyMilli: e.qtyMilli,
        unitPriceGr: e.unitPriceGr,
        valueGr: e.valueGr,
        sourceKind: e.sourceKind,
        sourceQuote: e.sourceQuote,
      })),
    );
    const brodzik = items[4]!;
    expect(brodzik.missingPrice).toBe(true);
    expect(brodzik.priceListItemId).toBeNull();
    expect(items.filter((i) => i.missingPrice)).toHaveLength(1);
    expect(items[2]!.sourceQuestionId).toBe('q1');
  });

  it('totals before the missing price: 7 370,00 net / 589,60 VAT / 7 959,60 gross, cannot send', () => {
    const t = expected.totalsBeforeMissingPrice;
    const r = priceOffer(base);
    expect(r.netGr).toBe(t.netGr);
    expect(r.vatBps).toBe(t.vatBps);
    expect(r.vatGr).toBe(t.vatGr);
    expect(r.grossGr).toBe(t.grossGr);
    expect(r.missingPriceCount).toBe(t.missingPriceCount);
    expect(r.canSend).toBe(t.canSend);
  });

  it('after the user sets 900 zł for the brodzik: 8 270,00 / 661,60 / 8 931,60, can send', () => {
    const key = brodzikKey(priceOffer(base));
    const r = priceOffer({
      ...base,
      overrides: [{ kind: 'edit', key, unitPriceGr: expected.afterUserSetsPrice.unitPriceGr }],
    });
    const t = expected.totalsFinal;
    expect(r.netGr).toBe(t.netGr);
    expect(r.vatGr).toBe(t.vatGr);
    expect(r.grossGr).toBe(t.grossGr);
    expect(r.missingPriceCount).toBe(t.missingPriceCount);
    expect(r.canSend).toBe(t.canSend);

    const brodzik = r.items.find((i) => i.key === key)!;
    expect(brodzik.valueGr).toBe(90000);
    expect(brodzik.locked).toBe(true);
    expect(brodzik.missingPrice).toBe(false);

    expect(plain(formatPLN(r.netGr))).toBe(expected.formatted.net);
    expect(plain(formatPLN(r.vatGr))).toBe(expected.formatted.vat);
    expect(plain(formatPLN(r.grossGr))).toBe(expected.formatted.gross);
  });

  it('gives the same result once the brodzik is saved to the price list and the offer is re-priced', () => {
    const np = expected.afterUserSetsPrice.newPriceListItem;
    const withBrodzik = [
      ...priceList,
      {
        id: 'brodzik_walk_in',
        name: np.name,
        offerName: np.offerName,
        unit: 'kpl' as const,
        measure: 'count' as const,
        priceGr: expected.afterUserSetsPrice.unitPriceGr,
        tags: ['fixture'],
      },
    ];
    const extraction: Extraction = {
      ...step2,
      items: step2.items.map((i) =>
        i.proposedName === 'Montaż brodzika walk-in'
          ? { ...i, priceListItemId: 'brodzik_walk_in', proposedName: null }
          : i,
      ),
    };
    const r = priceOffer({ ...base, extraction, priceList: withBrodzik });
    expect(r.items.map((i) => i.name)).toEqual(expected.itemsInOrder.map((i) => i.name));
    expect(r.grossGr).toBe(expected.totalsFinal.grossGr);
    expect(r.canSend).toBe(true);
  });

  it('step 1 (before answering) has no floor tiles and one open question', () => {
    const r = priceOffer({ ...base, extraction: step1, answers: {} });
    expect(r.items.map((i) => i.name)).not.toContain('Płytki – podłoga');
    expect(r.netGr).toBe(737000 - 96000);
    expect(r.questions).toEqual([{ ...step1.questions[0], answer: null }]);
  });

  it('reports the answer next to the question it resolves', () => {
    const r = priceOffer({ ...base, extraction: { ...step2, questions: step1.questions } });
    expect(r.questions[0]!.answer).toBe('Tak');
  });

  it('has no warnings – every quote is found in the transcript', () => {
    expect(priceOffer(base).warnings).toEqual([]);
  });
});
