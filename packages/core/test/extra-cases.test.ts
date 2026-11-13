import { describe, expect, it } from 'vitest';
import { formatPLN, vatLabel } from '../src/money';
import { priceOffer } from '../src/pricing';
import { extraction, fixture, input, item, plain, room, step2 } from './helpers';

const cases = Object.fromEntries(fixture.extraCasesToTest.map((c) => [c.name, c]));

describe('extraCasesToTest from the fixture', () => {
  it('Mozaika +20%', () => {
    const c = cases['Mozaika +20%']!;
    const r = priceOffer(
      input({
        extraction: extraction({
          items: [item({ priceListItemId: 'plytki_standard_sciany', scope: 'walls', mosaic: true })],
        }),
      }),
    );
    const it0 = r.items[0]!;
    expect(it0.qtyMilli).toBe(24400);
    expect(it0.unitPriceGr).toBe(14000);
    expect(it0.surchargeBps).toBe(2000);
    expect(it0.valueGr).toBe(c.expectedValueGr);
  });

  it('Wysokość > 3 m +15% tylko na ściany', () => {
    const c = cases['Wysokość > 3 m +15% tylko na ściany']!;
    const r = priceOffer(
      input({
        extraction: extraction({
          rooms: [room(4, 3, 3.2)],
          items: [
            item({ priceListItemId: 'plytki_standard_sciany', scope: 'walls' }),
            item({ priceListItemId: 'plytki_podloga', scope: 'floor' }),
          ],
        }),
      }),
    );
    const [walls, floor] = r.items;
    expect(walls!.qtyMilli).toBe(c.expectedQtyMilli);
    expect(walls!.surchargeBps).toBe(1500);
    expect(walls!.valueGr).toBe(c.expectedValueGr);
    // Floor items never get the height surcharge.
    expect(floor!.surchargeBps).toBe(0);
    expect(floor!.valueGr).toBe(12 * 16000);
  });

  it('Minimalna kwota zlecenia', () => {
    const r = priceOffer(
      input({
        extraction: extraction({
          items: [
            item({ priceListItemId: 'silikonowanie', scope: 'manual', manualQty: { value: 5, unit: 'mb' } }),
          ],
        }),
      }),
    );
    expect(r.items).toHaveLength(2);
    expect(r.items[0]!.valueGr).toBe(7500);
    const minOrder = r.items[1]!;
    expect(minOrder.name).toBe('Dopłata do minimalnej kwoty zlecenia');
    expect(minOrder.sourceKind).toBe('rule');
    expect(minOrder.valueGr).toBe(42500);
    expect(plain(formatPLN(minOrder.valueGr!))).toBe('425,00 zł');
    expect(r.netGr).toBe(50000);
  });

  it('Płytki do 2 m', () => {
    const c = cases['Płytki do 2 m']!;
    const r = priceOffer(
      input({
        extraction: extraction({
          items: [item({ priceListItemId: 'plytki_standard_sciany', scope: 'walls', tileHeightM: 2.0 })],
        }),
      }),
    );
    expect(r.items[0]!.qtyMilli).toBe(c.expectedQtyMilli);
  });

  it('Zwolniony z VAT', () => {
    const before = priceOffer(input({ extraction: step2, vatBps: null }));
    const key = before.items.find((i) => i.missingPrice)!.key;
    const r = priceOffer(
      input({ extraction: step2, vatBps: null, overrides: [{ kind: 'edit', key, unitPriceGr: 90000 }] }),
    );
    expect(r.netGr).toBe(827000);
    expect(r.vatGr).toBe(0);
    expect(r.grossGr).toBe(827000);
    expect(plain(formatPLN(r.grossGr))).toBe('8 270,00 zł');
    expect(vatLabel(r.vatBps)).toBe('zw.');
  });

  it('Zaokrąglanie ilości', () => {
    const c = cases['Zaokrąglanie ilości']!;
    const r = priceOffer(
      input({
        extraction: extraction({
          rooms: [room(2.35, 1.85, 2.6)],
          items: [item({ priceListItemId: 'plytki_podloga', scope: 'floor' })],
        }),
      }),
    );
    expect(r.items[0]!.qtyMilli).toBe(c.expectedQtyMilli);
  });

  it('covers every case listed in the fixture', () => {
    expect(Object.keys(cases)).toHaveLength(6);
  });
});
