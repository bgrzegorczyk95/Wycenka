import type { PricingRuleKind, Scope, Unit } from '../schemas';
import ekipaRemontowa from './ekipa_remontowa.json';
import elektryk from './elektryk.json';
import glazurnik from './glazurnik.json';
import hydraulik from './hydraulik.json';
import malarz from './malarz.json';
import oknaDrzwi from './okna_drzwi.json';
import podlogi from './podlogi.json';
import sucheZabudowy from './suche_zabudowy.json';

/** Trade templates: lists of work WITHOUT prices (docs/05-ai-i-wycena.md §5). */

export interface TemplateItem {
  key: string;
  category: string;
  name: string;
  offerName: string | null;
  unit: Unit;
  measure: Scope;
  tags: string[];
  aliases: string[];
}

export interface TradeTemplate {
  trade: string;
  label: string;
  description: string;
  categories: string[];
  items: TemplateItem[];
}

/** Order = tiles on the Profesja screen. */
export const TRADES: readonly TradeTemplate[] = [
  glazurnik,
  malarz,
  elektryk,
  hydraulik,
  sucheZabudowy,
  podlogi,
  oknaDrzwi,
  ekipaRemontowa,
] as TradeTemplate[];

export function getTemplate(trade: string): TradeTemplate | undefined {
  return TRADES.find((t) => t.trade === trade);
}

export function templateKey(trade: string, key: string): string {
  return `${trade}.${key}`;
}

export interface OnboardingItem extends TemplateItem {
  trade: string;
  templateKey: string;
}

/** Items for the „Wpisz swoje stawki” step: selected trades in order, duplicates (same name) removed. */
export function onboardingItems(trades: readonly string[]): OnboardingItem[] {
  const seen = new Set<string>();
  const result: OnboardingItem[] = [];
  for (const trade of trades) {
    for (const item of getTemplate(trade)?.items ?? []) {
      if (seen.has(item.name)) continue;
      seen.add(item.name);
      result.push({ ...item, trade, templateKey: templateKey(trade, item.key) });
    }
  }
  return result;
}

export interface DefaultRule {
  kind: PricingRuleKind;
  label: string;
  bps?: number;
  amountGr?: number;
  thresholdMilli?: number;
  enabled: boolean;
}

/**
 * „Dopłaty i zasady” created with the price list. Values are proposals the contractor edits
 * (Cennik screen) – they are rules, not prices of work.
 */
export const DEFAULT_RULES: readonly DefaultRule[] = [
  { kind: 'mosaic_surcharge', label: 'Mozaika i drobne formaty', bps: 2000, enabled: true },
  { kind: 'height_surcharge', label: 'Wysokość powyżej 3 m', bps: 1500, thresholdMilli: 3000, enabled: true },
  { kind: 'min_order', label: 'Minimalna kwota zlecenia', amountGr: 50000, enabled: true },
  { kind: 'travel_fee', label: 'Dojazd poza miasto', amountGr: 10000, enabled: true },
  { kind: 'material_markup', label: 'Materiał wykonawcy – narzut', bps: 1000, enabled: true },
];
