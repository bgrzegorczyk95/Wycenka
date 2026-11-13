import { describe, expect, it } from 'vitest';
import {
  areaQtyMilli,
  computeRoomGeometry,
  lengthQtyMilli,
  metersToMm,
  roundQtyMilli,
  wallAreaMm2,
} from '../src/geometry';
import { room } from './helpers';

describe('computeRoomGeometry', () => {
  it('3,0 × 2,0 × 2,6 m with the default door', () => {
    const g = computeRoomGeometry(room(3, 2, 2.6));
    expect(g).toEqual({
      roomId: 'r1',
      name: 'Pokój',
      lengthMm: 3000,
      widthMm: 2000,
      heightMm: 2600,
      perimeterMm: 10000,
      wallsGrossMm2: 26_000_000,
      openingsMm2: 1_600_000,
      wallsMm2: 24_400_000,
      floorMm2: 6_000_000,
      ceilingMm2: 6_000_000,
      perimeterTrimMm: 9200,
      wallsQtyMilli: 24400,
      floorQtyMilli: 6000,
      perimeterTrimQtyMilli: 9200,
      openings: [{ kind: 'door', widthMm: 800, heightMm: 2000 }],
      assumedDefaultDoor: true,
    });
  });

  it('uses the given openings (door and window) instead of the default door', () => {
    const g = computeRoomGeometry(
      room(4, 3, 2.5, [
        { kind: 'door', widthM: 0.9, heightM: 2.0 },
        { kind: 'window', widthM: 1.2, heightM: 1.5 },
      ]),
    );
    expect(g.assumedDefaultDoor).toBe(false);
    expect(g.openingsMm2).toBe(900 * 2000 + 1200 * 1500);
    expect(g.wallsMm2).toBe(14000 * 2500 - 3_600_000);
    // Only door widths are subtracted from the trim length.
    expect(g.perimeterTrimMm).toBe(14000 - 900);
  });

  it('an empty openings list means no openings', () => {
    const g = computeRoomGeometry(room(3, 2, 2.6, []));
    expect(g.openingsMm2).toBe(0);
    expect(g.wallsMm2).toBe(26_000_000);
    expect(g.perimeterTrimMm).toBe(10000);
    expect(g.assumedDefaultDoor).toBe(false);
  });

  it('caps an opening at the room height', () => {
    const g = computeRoomGeometry(room(3, 2, 1.8, [{ kind: 'door', widthM: 1, heightM: 2.2 }]));
    expect(g.openingsMm2).toBe(1000 * 1800);
  });

  it('never returns negative wall area or trim', () => {
    const g = computeRoomGeometry(room(1, 1, 1, [{ kind: 'door', widthM: 5, heightM: 1 }]));
    expect(g.wallsMm2).toBe(0);
    expect(g.perimeterTrimMm).toBe(0);
  });

  it('without height: floor is known, walls are not', () => {
    const g = computeRoomGeometry(room(3, 2, null));
    expect(g.floorMm2).toBe(6_000_000);
    expect(g.perimeterMm).toBe(10000);
    expect(g.wallsMm2).toBeNull();
    expect(g.wallsGrossMm2).toBeNull();
    expect(g.openingsMm2).toBeNull();
    expect(g.wallsQtyMilli).toBeNull();
  });

  it('without length or width: nothing can be measured', () => {
    for (const r of [room(null, 2, 2.6), room(3, null, 2.6)]) {
      const g = computeRoomGeometry(r);
      expect(g.perimeterMm).toBeNull();
      expect(g.floorMm2).toBeNull();
      expect(g.ceilingMm2).toBeNull();
      expect(g.wallsMm2).toBeNull();
      expect(g.perimeterTrimMm).toBeNull();
      expect(g.floorQtyMilli).toBeNull();
      expect(g.perimeterTrimQtyMilli).toBeNull();
    }
  });
});

describe('wallAreaMm2', () => {
  it('tiles up to 2 m: 10 × 2,0 − 0,8 × min(2,0; 2,0) = 18,4 m²', () => {
    const g = computeRoomGeometry(room(3, 2, 2.6));
    expect(wallAreaMm2(g, 2000)).toBe(18_400_000);
  });
  it('returns null when the room has no perimeter', () => {
    expect(wallAreaMm2(computeRoomGeometry(room(null, 2, 2.6)), 2000)).toBeNull();
  });
});

describe('quantity rounding to 0,1 (half up)', () => {
  it.each([
    [4_347_500, 4300], // 4,3475 m² → 4,3
    [4_350_000, 4400], // 4,35 m² → 4,4
    [4_349_999, 4300],
    [24_400_000, 24400],
  ])('area %i mm² → %i milli', (mm2, milli) => {
    expect(areaQtyMilli(mm2)).toBe(milli);
  });

  it.each([
    [9250, 9300],
    [9249, 9200],
  ])('length %i mm → %i milli', (mm, milli) => {
    expect(lengthQtyMilli(mm)).toBe(milli);
  });

  it.each([
    [4350, 'm2', 4400],
    [4349, 'mb', 4300],
    [1500, 'szt', 2000],
    [1499, 'kpl', 1000],
    [1234, 'h', 1234],
  ] as const)('%i %s → %i', (milli, unit, expected) => {
    expect(roundQtyMilli(milli, unit)).toBe(expected);
  });

  it('metersToMm rounds to the nearest millimetre', () => {
    expect(metersToMm(2.6)).toBe(2600);
    expect(metersToMm(2.35)).toBe(2350);
    expect(metersToMm(0.0004)).toBe(0);
  });
});
