import { roundHalfUp } from './money';
import type { ExtractionRoom, Unit } from './schemas';

/**
 * Room geometry in integer millimetres (lengths) and mm² (areas).
 * Quantities for offer items are in thousandths of a unit (qtyMilli): 1 mb = 1000, 1 m² = 1000.
 */

/** Assumed when the transcript does not mention openings: one door 0,8 × 2,0 m. */
export const DEFAULT_DOOR = { kind: 'door', widthMm: 800, heightMm: 2000 } as const;

export interface RoomGeometry {
  roomId: string;
  name: string;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  perimeterMm: number | null;
  wallsGrossMm2: number | null;
  openingsMm2: number | null;
  /** Wall area up to the ceiling minus openings. */
  wallsMm2: number | null;
  floorMm2: number | null;
  ceilingMm2: number | null;
  /** Perimeter minus door widths (skirting, silicone). */
  perimeterTrimMm: number | null;
  wallsQtyMilli: number | null;
  floorQtyMilli: number | null;
  perimeterTrimQtyMilli: number | null;
  /** Openings used for the calculation (the default door when none were mentioned). */
  openings: OpeningMm[];
  assumedDefaultDoor: boolean;
}

export interface OpeningMm {
  kind: 'door' | 'window';
  widthMm: number;
  heightMm: number;
}

export function metersToMm(m: number): number {
  return Math.round(m * 1000);
}

/** mm² → m² in thousandths, rounded half up to 0,1 m². */
export function areaQtyMilli(mm2: number): number {
  return Number(roundHalfUp(BigInt(mm2), 100_000n)) * 100;
}

/** mm → mb in thousandths, rounded half up to 0,1 mb. */
export function lengthQtyMilli(mm: number): number {
  return Number(roundHalfUp(BigInt(mm), 100n)) * 100;
}

/** m² and mb → 0,1; szt and kpl → whole units; h → unchanged (thousandths). */
export function roundQtyMilli(qtyMilli: number, unit: Unit): number {
  switch (unit) {
    case 'm2':
    case 'mb':
      return Number(roundHalfUp(BigInt(qtyMilli), 100n)) * 100;
    case 'szt':
    case 'kpl':
      return Number(roundHalfUp(BigInt(qtyMilli), 1000n)) * 1000;
    case 'h':
      return qtyMilli;
  }
}

const mmOrNull = (m: number | null): number | null => (m === null ? null : metersToMm(m));

export function computeRoomGeometry(room: ExtractionRoom): RoomGeometry {
  const lengthMm = mmOrNull(room.lengthM);
  const widthMm = mmOrNull(room.widthM);
  const heightMm = mmOrNull(room.heightM);
  const assumedDefaultDoor = room.openings === null;
  const openings: OpeningMm[] =
    room.openings === null
      ? [{ ...DEFAULT_DOOR }]
      : room.openings.map((o) => ({
          kind: o.kind,
          widthMm: metersToMm(o.widthM),
          heightMm: metersToMm(o.heightM),
        }));

  const hasPlan = lengthMm !== null && widthMm !== null;
  const perimeterMm = hasPlan ? 2 * (lengthMm + widthMm) : null;
  const floorMm2 = hasPlan ? lengthMm * widthMm : null;
  const doorWidthsMm = openings.filter((o) => o.kind === 'door').reduce((sum, o) => sum + o.widthMm, 0);
  const perimeterTrimMm = perimeterMm === null ? null : Math.max(0, perimeterMm - doorWidthsMm);

  const hasWalls = perimeterMm !== null && heightMm !== null;
  const wallsGrossMm2 = hasWalls ? perimeterMm * heightMm : null;
  const openingsMm2 = hasWalls ? openingsAreaMm2(openings, heightMm) : null;
  const wallsMm2 = hasWalls ? Math.max(0, wallsGrossMm2! - openingsMm2!) : null;

  return {
    roomId: room.id,
    name: room.name,
    lengthMm,
    widthMm,
    heightMm,
    perimeterMm,
    wallsGrossMm2,
    openingsMm2,
    wallsMm2,
    floorMm2,
    ceilingMm2: floorMm2,
    perimeterTrimMm,
    wallsQtyMilli: wallsMm2 === null ? null : areaQtyMilli(wallsMm2),
    floorQtyMilli: floorMm2 === null ? null : areaQtyMilli(floorMm2),
    perimeterTrimQtyMilli: perimeterTrimMm === null ? null : lengthQtyMilli(perimeterTrimMm),
    openings,
    assumedDefaultDoor,
  };
}

function openingsAreaMm2(openings: OpeningMm[], heightMm: number): number {
  return openings.reduce((sum, o) => sum + o.widthMm * Math.min(o.heightMm, heightMm), 0);
}

/**
 * Wall area up to `heightMm` (e.g. tiles up to 2 m): perimeter × h − Σ w × min(opening h, h).
 * Null when the room has no perimeter.
 */
export function wallAreaMm2(geometry: RoomGeometry, heightMm: number): number | null {
  if (geometry.perimeterMm === null) return null;
  return Math.max(0, geometry.perimeterMm * heightMm - openingsAreaMm2(geometry.openings, heightMm));
}
