import { describe, expect, it } from 'vitest';
import { itemValueGr, normalizeForQuote, priceOffer } from '../src/pricing';
import type { PriceListItem, PricingRule } from '../src/schemas';
import { extraction, input, item, priceList, room, rules, step2 } from './helpers';

const codes = (r: ReturnType<typeof priceOffer>) => r.warnings.map((w) => w.code);

describe('itemValueGr', () => {
  it('multiplies in BigInt and rounds half up', () => {
    expect(itemValueGr(30400, 4500, 0)).toBe(136800);
    expect(itemValueGr(1, 1, 0)).toBe(0); // 0,001 gr
    expect(itemValueGr(500, 1, 0)).toBe(1); // 0,5 gr → 1 gr
    expect(itemValueGr(24400, 14000, 2000)).toBe(409920);
  });

  it('stays exact where float math would overflow the safe integer range', () => {
    // 900 000 m² × 999 999,99 zł × 1,35 – iloczyn ≫ 2^53
    expect(itemValueGr(900_000_000, 99_999_999, 3500)).toBe(121_499_998_785_000);
  });
});

describe('quantities by scope', () => {
  it('ceiling = floor area; perimeter = trim length without doors', () => {
    const pl: PriceListItem[] = [
      ...priceList,
      {
        id: 'sufit',
        name: 'Malowanie sufitu',
        offerName: null,
        unit: 'm2',
        measure: 'ceiling',
        priceGr: 2000,
        tags: [],
      },
    ];
    const r = priceOffer(
      input({
        priceList: pl,
        rules: [], // keep the minimum-order top-up out of this test
        extraction: extraction({
          items: [
            item({ priceListItemId: 'sufit', scope: 'ceiling' }),
            item({ priceListItemId: 'listwa_naroznik', scope: 'perimeter' }),
          ],
        }),
      }),
    );
    expect(r.items.map((i) => [i.name, i.qtyMilli])).toEqual([
      ['Listwa / narożnik', 9200],
      ['Malowanie sufitu', 6000],
    ]);
  });

  it('count defaults to 1 and multiplies otherwise', () => {
    const r = priceOffer(
      input({
        extraction: extraction({
          items: [
            item({ priceListItemId: 'stelaz_wc', scope: 'count', count: 2 }),
            item({ proposedName: 'Montaż umywalki', scope: 'count' }),
          ],
        }),
      }),
    );
    expect(r.items.map((i) => i.qtyMilli)).toEqual([2000, 1000]);
    expect(r.items[0]!.valueGr).toBe(130000);
  });

  it('walls_floor = rounded walls + rounded floor; tile height applies to the wall part', () => {
    const r = priceOffer(
      input({
        extraction: extraction({
          items: [item({ priceListItemId: 'skucie_plytek', scope: 'walls_floor', tileHeightM: 2 })],
        }),
      }),
    );
    expect(r.items[0]!.qtyMilli).toBe(18400 + 6000);
    expect(r.items[0]!.name).toBe('Skucie płytek (ściany + podłoga)');
  });

  it('tile height above the room height is capped at the room height', () => {
    const r = priceOffer(
      input({
        extraction: extraction({
          items: [item({ priceListItemId: 'plytki_standard_sciany', scope: 'walls', tileHeightM: 3.5 })],
        }),
      }),
    );
    expect(r.items[0]!.qtyMilli).toBe(24400);
  });

  it('manual quantity is rounded per unit', () => {
    const r = priceOffer(
      input({
        extraction: extraction({
          items: [
            item({
              priceListItemId: 'hydroizolacja',
              scope: 'manual',
              manualQty: { value: 4.35, unit: 'm2' },
            }),
          ],
        }),
      }),
    );
    expect(r.items[0]!.qtyMilli).toBe(4400);
  });

  it('manual without a quantity → 1 and a warning', () => {
    const r = priceOffer(
      input({ extraction: extraction({ items: [item({ priceListItemId: 'stelaz_wc', scope: 'manual' })] }) }),
    );
    expect(r.items[0]!.qtyMilli).toBe(1000);
    expect(codes(r)).toEqual(['manual_qty_missing']);
  });

  it('manual quantity in a different unit than the price list → 1 and a warning', () => {
    const r = priceOffer(
      input({
        extraction: extraction({
          items: [
            item({ priceListItemId: 'hydroizolacja', scope: 'manual', manualQty: { value: 4, unit: 'mb' } }),
          ],
        }),
      }),
    );
    expect(r.items[0]!.qtyMilli).toBe(1000);
    expect(codes(r)).toEqual(['unit_scope_mismatch']);
  });

  it('unit not matching the scope → quantity 1 and a warning', () => {
    const r = priceOffer(
      input({
        extraction: extraction({
          items: [
            item({ priceListItemId: 'stelaz_wc', scope: 'floor' }),
            item({ priceListItemId: 'plytki_podloga', scope: 'count' }),
            item({ priceListItemId: 'silikonowanie', scope: 'walls' }),
          ],
        }),
      }),
    );
    expect(r.items.map((i) => i.qtyMilli)).toEqual([1000, 1000, 1000]);
    expect(codes(r)).toEqual(['unit_scope_mismatch', 'unit_scope_mismatch', 'unit_scope_mismatch']);
    // Warnings follow the order of items on the offer.
    expect(r.warnings.map((w) => w.itemKey)).toEqual(r.items.map((i) => i.key));
  });

  it('missing dimensions → quantity 0 and a warning', () => {
    const r = priceOffer(
      input({
        extraction: extraction({
          rooms: [room(3, 2, null)],
          items: [
            item({ priceListItemId: 'plytki_standard_sciany', scope: 'walls' }),
            item({ priceListItemId: 'plytki_podloga', scope: 'floor' }),
          ],
        }),
      }),
    );
    expect(r.items.map((i) => i.qtyMilli)).toEqual([0, 6000]);
    // An unknown height is not "out of range" – the item warning covers it.
    expect(codes(r)).toEqual(['missing_dimensions']);
  });

  it('missing dimensions for walls_floor and perimeter', () => {
    const r = priceOffer(
      input({
        extraction: extraction({
          rooms: [room(null, null, 2.6)],
          items: [
            item({ priceListItemId: 'skucie_plytek', scope: 'walls_floor' }),
            item({ priceListItemId: 'listwa_naroznik', scope: 'perimeter' }),
            item({ priceListItemId: 'plytki_podloga', scope: 'floor' }),
          ],
        }),
      }),
    );
    expect(r.items.every((i) => i.qtyMilli === 0)).toBe(true);
    expect(codes(r).filter((c) => c === 'missing_dimensions')).toHaveLength(3);
  });

  it('item without roomId uses the only room; with several rooms it needs a roomId', () => {
    const one = priceOffer(
      input({
        extraction: extraction({
          items: [item({ priceListItemId: 'plytki_podloga', scope: 'floor', roomId: null })],
        }),
      }),
    );
    expect(one.items[0]!.qtyMilli).toBe(6000);

    const two = priceOffer(
      input({
        extraction: extraction({
          rooms: [room(3, 2, 2.6), room(4, 3, 2.6, null, 'r2')],
          items: [
            item({ priceListItemId: 'plytki_podloga', scope: 'floor', roomId: null }),
            item({ priceListItemId: 'plytki_podloga', scope: 'floor', roomId: 'r2' }),
            item({ priceListItemId: 'plytki_podloga', scope: 'floor', roomId: 'nope' }),
          ],
        }),
      }),
    );
    expect(two.items.map((i) => i.qtyMilli)).toEqual([12000, 0, 0]);
    expect(two.geometry).toHaveLength(2);
  });
});

describe('ordering', () => {
  it('groups by room, then price-list order; items outside the price list go last in their room', () => {
    const r = priceOffer(
      input({
        extraction: extraction({
          rooms: [room(3, 2, 2.6), room(4, 3, 2.6, null, 'r2')],
          items: [
            item({ proposedName: 'Montaż brodzika walk-in', roomId: 'r1' }),
            item({ priceListItemId: 'stelaz_wc', roomId: 'r1' }),
            item({ priceListItemId: 'plytki_podloga', scope: 'floor', roomId: 'r2' }),
            item({ priceListItemId: 'skucie_plytek', scope: 'walls_floor', roomId: 'r1' }),
            item({ priceListItemId: 'stelaz_wc', roomId: null }),
          ],
        }),
      }),
    );
    expect(r.items.map((i) => `${i.roomId}:${i.name}`)).toEqual([
      'r1:Skucie płytek (ściany + podłoga)',
      'r1:Montaż stelaża podtynkowego WC',
      'r1:Montaż brodzika walk-in',
      'r2:Płytki – podłoga',
      'null:Montaż stelaża podtynkowego WC',
    ]);
  });

  it('gives duplicate items unique keys', () => {
    const r = priceOffer(
      input({
        extraction: extraction({
          items: [item({ priceListItemId: 'stelaz_wc' }), item({ priceListItemId: 'stelaz_wc' })],
        }),
      }),
    );
    const keys = r.items.map((i) => i.key);
    expect(new Set(keys).size).toBe(2);
  });
});

describe('items outside the price list', () => {
  it('unknown priceListItemId is treated as missing and flagged', () => {
    const r = priceOffer(
      input({
        extraction: extraction({
          items: [item({ priceListItemId: 'made_up', proposedName: 'Coś nowego', quote: 'coś' })],
        }),
      }),
    );
    expect(r.items[0]).toMatchObject({
      priceListItemId: null,
      name: 'Coś nowego',
      unitPriceGr: null,
      valueGr: null,
      missingPrice: true,
    });
    expect(codes(r)).toEqual(['unknown_price_list_item']);
    expect(r.canSend).toBe(false);
  });

  it('falls back to a generic name and derives the unit from the scope', () => {
    const r = priceOffer(
      input({
        extraction: extraction({
          items: [
            item({ scope: 'floor' }),
            item({ scope: 'perimeter' }),
            item({ scope: 'manual', manualQty: { value: 3, unit: 'h' } }),
            item({ scope: 'manual' }),
          ],
        }),
      }),
    );
    expect(r.items.map((i) => [i.name, i.unit, i.qtyMilli])).toEqual([
      ['Pozycja spoza cennika', 'm2', 6000],
      ['Pozycja spoza cennika', 'mb', 9200],
      ['Pozycja spoza cennika', 'h', 3000],
      ['Pozycja spoza cennika', 'kpl', 1000],
    ]);
    expect(r.missingPriceCount).toBe(4);
  });

  it('no price → no surcharges are lost: they apply once a price is entered', () => {
    const before = priceOffer(
      input({
        extraction: extraction({
          rooms: [room(4, 3, 3.2)],
          items: [item({ proposedName: 'Mozaika', scope: 'walls', mosaic: true })],
        }),
      }),
    );
    // Missing items have no tags, so no surcharges – the user price is taken as is.
    const key = before.items[0]!.key;
    const after = priceOffer(
      input({
        extraction: extraction({
          rooms: [room(4, 3, 3.2)],
          items: [item({ proposedName: 'Mozaika', scope: 'walls', mosaic: true })],
        }),
        overrides: [{ kind: 'edit', key, unitPriceGr: 10000 }],
      }),
    );
    expect(after.items[0]!.surchargeBps).toBe(0);
    expect(after.items[0]!.valueGr).toBe(43200 * 10);
  });
});

describe('surcharges', () => {
  const highRoom = room(4, 3, 3.2);

  it('mosaic only for mosaic-eligible items', () => {
    const r = priceOffer(
      input({
        extraction: extraction({
          items: [
            item({ priceListItemId: 'plytki_podloga', scope: 'floor', mosaic: true }),
            item({ priceListItemId: 'plytki_60x120_sciany', scope: 'walls', mosaic: true }),
          ],
        }),
      }),
    );
    expect(r.items.map((i) => i.surchargeBps)).toEqual([0, 2000]);
    // Order follows the price list: 60×120 (index 4) before floor (index 5).
    expect(r.items[0]!.name).toBe('Płytki 60×120 – ściany');
  });

  it('height applies to walls_floor items tagged „wall” (whole item) and stacks with mosaic', () => {
    const r = priceOffer(
      input({
        extraction: extraction({
          rooms: [highRoom],
          items: [
            item({ priceListItemId: 'skucie_plytek', scope: 'walls_floor' }),
            item({ priceListItemId: 'plytki_standard_sciany', scope: 'walls', mosaic: true }),
          ],
        }),
      }),
    );
    expect(r.items.map((i) => i.surchargeBps)).toEqual([1500, 3500]);
  });

  it('height at exactly the threshold does not apply', () => {
    const r = priceOffer(
      input({
        extraction: extraction({
          rooms: [room(4, 3, 3.0)],
          items: [item({ priceListItemId: 'plytki_standard_sciany', scope: 'walls' })],
        }),
      }),
    );
    expect(r.items[0]!.surchargeBps).toBe(0);
  });

  it('disabled rules and rules without values do nothing', () => {
    const off: PricingRule[] = rules.map((r) => ({ ...r, enabled: false }));
    const empty: PricingRule[] = [
      { kind: 'mosaic_surcharge', enabled: true },
      { kind: 'height_surcharge', bps: 1500, enabled: true },
      { kind: 'min_order', enabled: true },
      { kind: 'travel_fee', enabled: true },
    ];
    for (const rs of [off, empty, []]) {
      const r = priceOffer(
        input({
          rules: rs,
          extraction: extraction({
            rooms: [highRoom],
            outOfTown: true,
            items: [item({ priceListItemId: 'plytki_standard_sciany', scope: 'walls', mosaic: true })],
          }),
        }),
      );
      expect(r.items).toHaveLength(1);
      expect(r.items[0]!.surchargeBps).toBe(0);
    }
  });

  it('material markup only with contractor material and the „material” tag', () => {
    const pl: PriceListItem[] = [
      ...priceList,
      {
        id: 'klej',
        name: 'Klej do płytek',
        offerName: null,
        unit: 'm2',
        measure: 'floor',
        priceGr: 2000,
        tags: ['material'],
      },
    ];
    const items = [
      item({ priceListItemId: 'klej', scope: 'floor' }),
      item({ priceListItemId: 'plytki_podloga', scope: 'floor' }),
    ];
    const contractor = priceOffer(
      input({ priceList: pl, extraction: extraction({ material: 'contractor', items }) }),
    );
    expect(contractor.items.map((i) => [i.name, i.surchargeBps])).toEqual([
      ['Płytki – podłoga', 0],
      ['Klej do płytek', 1000],
    ]);
    const client = priceOffer(
      input({ priceList: pl, extraction: extraction({ material: 'client', items }) }),
    );
    expect(client.items.every((i) => i.surchargeBps === 0)).toBe(true);
  });
});

describe('rule items, discount and VAT', () => {
  it('adds the travel fee when out of town', () => {
    const r = priceOffer(input({ extraction: { ...step2, outOfTown: true } }));
    const travel = r.items.at(-1)!;
    expect(travel).toMatchObject({
      key: 'rule:travel_fee',
      name: 'Dojazd poza miasto',
      unit: 'kpl',
      qtyMilli: 1000,
      unitPriceGr: 10000,
      valueGr: 10000,
      sourceKind: 'rule',
      sourceQuote: null,
    });
    expect(r.netGr).toBe(737000 + 10000);
  });

  it('uses the rule label for the travel fee when given', () => {
    const r = priceOffer(
      input({
        rules: [{ kind: 'travel_fee', label: 'Dojazd', amountGr: 5000, enabled: true }],
        extraction: { ...step2, outOfTown: true },
      }),
    );
    expect(r.items.at(-1)!.name).toBe('Dojazd');
  });

  it('min order compares items without travel and is skipped when nothing is priced yet', () => {
    const travelAndSmall = priceOffer(
      input({
        extraction: extraction({
          outOfTown: true,
          items: [
            item({ priceListItemId: 'silikonowanie', scope: 'manual', manualQty: { value: 5, unit: 'mb' } }),
          ],
        }),
      }),
    );
    expect(travelAndSmall.items.map((i) => i.key)).toEqual([
      travelAndSmall.items[0]!.key,
      'rule:travel_fee',
      'rule:min_order',
    ]);
    expect(travelAndSmall.netGr).toBe(7500 + 10000 + 42500);

    const nothingPriced = priceOffer(
      input({ extraction: extraction({ items: [item({ proposedName: 'Coś', scope: 'count' })] }) }),
    );
    expect(nothingPriced.items).toHaveLength(1);
    expect(nothingPriced.netGr).toBe(0);
    expect(nothingPriced.canSend).toBe(false);
  });

  it('discount in percent is taken from the total incl. rule items, rounded half up', () => {
    const r = priceOffer(input({ extraction: step2, discount: { bps: 500 } }));
    expect(r.itemsSubtotalGr).toBe(737000);
    expect(r.discountGr).toBe(36850);
    expect(r.netGr).toBe(700150);
    expect(r.vatGr).toBe(56012);
    expect(r.grossGr).toBe(756162);
  });

  it('discount as an amount, combined with percent, never below zero', () => {
    expect(priceOffer(input({ extraction: step2, discount: { gr: 7000 } })).netGr).toBe(730000);
    expect(priceOffer(input({ extraction: step2, discount: { bps: 1000, gr: 300 } })).discountGr).toBe(74000);
    expect(priceOffer(input({ extraction: step2, discount: { gr: 10_000_000 } })).netGr).toBe(0);
    expect(priceOffer(input({ extraction: step2, discount: { bps: -100, gr: -5 } })).discountGr).toBe(0);
  });

  it('min order surcharge counts before the discount (net may go below the minimum)', () => {
    const r = priceOffer(
      input({
        extraction: extraction({
          items: [
            item({ priceListItemId: 'silikonowanie', scope: 'manual', manualQty: { value: 5, unit: 'mb' } }),
          ],
        }),
        discount: { bps: 1000 },
      }),
    );
    expect(r.netGr).toBe(45000);
  });
});

describe('overrides (locked user changes)', () => {
  const base = () => priceOffer(input({ extraction: step2 }));

  it('edit changes name, quantity and price and locks the item', () => {
    const key = base().items[0]!.key;
    const r = priceOffer(
      input({
        extraction: step2,
        overrides: [{ kind: 'edit', key, name: 'Skucie starych płytek', qtyMilli: 20000, unitPriceGr: 5000 }],
      }),
    );
    expect(r.items[0]).toMatchObject({
      key,
      name: 'Skucie starych płytek',
      qtyMilli: 20000,
      unitPriceGr: 5000,
      valueGr: 100000,
      locked: true,
    });
  });

  it('edit can clear a price back to missing', () => {
    const key = base().items[0]!.key;
    const r = priceOffer(input({ extraction: step2, overrides: [{ kind: 'edit', key, unitPriceGr: null }] }));
    expect(r.items[0]!.missingPrice).toBe(true);
    expect(r.missingPriceCount).toBe(2);
  });

  it('remove drops the item', () => {
    const key = base().items.find((i) => i.missingPrice)!.key;
    const r = priceOffer(input({ extraction: step2, overrides: [{ kind: 'remove', key }] }));
    expect(r.items).toHaveLength(4);
    expect(r.canSend).toBe(true);
    expect(r.grossGr).toBe(795960);
  });

  it('add inserts a manual item (price from the price list or own price)', () => {
    const r = priceOffer(
      input({
        extraction: step2,
        overrides: [
          {
            kind: 'add',
            key: 'm1',
            priceListItemId: 'gruntowanie',
            name: 'Gruntowanie',
            unit: 'm2',
            qtyMilli: 30400,
          },
          {
            kind: 'add',
            key: 'm2',
            priceListItemId: null,
            name: 'Wywóz gruzu',
            unit: 'kpl',
            qtyMilli: 1000,
            unitPriceGr: 30000,
          },
          { kind: 'add', key: 'm3', priceListItemId: null, name: 'Bez ceny', unit: 'szt', qtyMilli: 1000 },
        ],
      }),
    );
    const names = r.items.map((i) => i.name);
    expect(names.indexOf('Gruntowanie')).toBe(1); // price-list order: after skucie
    const grunt = r.items[1]!;
    expect(grunt).toMatchObject({
      sourceKind: 'manual',
      unitPriceGr: 800,
      valueGr: 24320,
      locked: true,
      roomId: null,
    });
    expect(r.items.find((i) => i.key === 'm2')!.valueGr).toBe(30000);
    expect(r.items.find((i) => i.key === 'm3')!.missingPrice).toBe(true);
  });

  it('edit of the quantity alone keeps the price-list price', () => {
    const key = base().items[1]!.key;
    const r = priceOffer(input({ extraction: step2, overrides: [{ kind: 'edit', key, qtyMilli: 20000 }] }));
    expect(r.items[1]).toMatchObject({ qtyMilli: 20000, unitPriceGr: 18000, valueGr: 360000, locked: true });
  });

  it('removing an item also drops its warnings', () => {
    const ex = extraction({ items: [item({ priceListItemId: 'stelaz_wc', scope: 'manual' })] });
    const key = priceOffer(input({ extraction: ex })).items[0]!.key;
    const r = priceOffer(input({ extraction: ex, overrides: [{ kind: 'remove', key }] }));
    expect(r.items).toHaveLength(0);
    expect(r.warnings).toEqual([]);
  });

  it('ignores overrides for keys that no longer exist', () => {
    const r = priceOffer(
      input({ extraction: step2, overrides: [{ kind: 'edit', key: 'gone', unitPriceGr: 1 }] }),
    );
    expect(r.netGr).toBe(737000);
  });
});

describe('warnings', () => {
  it('room dimensions and height out of range', () => {
    const r = priceOffer(input({ extraction: extraction({ rooms: [room(0.4, 31, 5.5)], items: [] }) }));
    expect(codes(r)).toEqual(['room_dimension_out_of_range', 'room_height_out_of_range']);
    expect(r.warnings[0]!.roomId).toBe('r1');
  });

  it('low ceiling is also out of range', () => {
    expect(codes(priceOffer(input({ extraction: extraction({ rooms: [room(3, 2, 1.9)] }) })))).toEqual([
      'room_height_out_of_range',
    ]);
  });

  it('checks large quantities', () => {
    const r = priceOffer(
      input({
        extraction: extraction({
          rooms: [room(25, 25, 2.6)],
          items: [
            item({ priceListItemId: 'plytki_podloga', scope: 'floor' }),
            item({ priceListItemId: 'stelaz_wc', scope: 'count', count: 51 }),
            item({ priceListItemId: 'plytki_standard_sciany', scope: 'walls' }),
          ],
        }),
      }),
    );
    expect(codes(r)).toEqual(['quantity_check', 'quantity_check']);
  });

  it('flags quotes not found in the transcript (normalized) and empty quotes', () => {
    const transcript = 'Łazienka dwa na trzy, skuwamy stare płytki.';
    const r = priceOffer(
      input({
        transcript,
        extraction: extraction({
          items: [
            item({ priceListItemId: 'skucie_plytek', scope: 'walls_floor', quote: 'SKUWAMY  stare plytki!' }),
            item({ priceListItemId: 'stelaz_wc', quote: 'stelaż podtynkowy' }),
            item({ priceListItemId: 'plytki_podloga', scope: 'floor', quote: '' }),
            item({ priceListItemId: 'plytki_podloga', scope: 'floor', quote: '', fromAnswerTo: 'q1' }),
          ],
        }),
      }),
    );
    expect(codes(r)).toEqual(['quote_not_found', 'quote_not_found']);
    // Without a transcript no quote check is possible.
    expect(
      codes(
        priceOffer(
          input({ extraction: extraction({ items: [item({ priceListItemId: 'stelaz_wc', quote: 'x' })] }) }),
        ),
      ),
    ).toEqual([]);
  });

  it('every warning has a Polish message', () => {
    const r = priceOffer(input({ extraction: extraction({ rooms: [room(0.4, 2, 2.6)] }) }));
    expect(r.warnings[0]!.message).toMatch(/wymiar/i);
  });

  it('normalizeForQuote strips case, Polish letters and punctuation', () => {
    expect(normalizeForQuote('Łazienka – ŻÓŁĆ, gęś!')).toBe('lazienka zolc ges');
  });
});
