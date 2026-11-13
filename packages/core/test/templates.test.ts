import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, TRADES, getTemplate, onboardingItems, templateKey } from '../src/templates';
import type { Scope, Unit } from '../src/schemas';

const AREA: Scope[] = ['walls', 'floor', 'walls_floor', 'ceiling', 'manual'];
const fits = (unit: Unit, measure: Scope): boolean =>
  unit === 'm2'
    ? AREA.includes(measure)
    : unit === 'mb'
      ? measure === 'perimeter' || measure === 'manual'
      : measure === 'count' || measure === 'manual';

describe('trade templates', () => {
  it('lists the 8 trades from the Profesja mockup in order', () => {
    expect(TRADES.map((t) => [t.label, t.description])).toEqual([
      ['Glazurnik', 'płytki, hydroizolacja, biały montaż'],
      ['Malarz', 'gładzie, malowanie, tapety'],
      ['Elektryk', 'instalacje, osprzęt, pomiary'],
      ['Hydraulik', 'wod-kan, c.o., biały montaż'],
      ['Suche zabudowy', 'G-K, sufity, ścianki'],
      ['Podłogi', 'panele, deski, wylewki'],
      ['Okna i drzwi', 'montaż, regulacja, parapety'],
      ['Ekipa remontowa', 'kompleksowe remonty'],
    ]);
  });

  it.each(TRADES.map((t) => [t.trade, t] as const))(
    '%s: 8–15 items, unique keys, no prices, consistent units',
    (_, t) => {
      expect(t.items.length).toBeGreaterThanOrEqual(8);
      expect(t.items.length).toBeLessThanOrEqual(15);
      expect(new Set(t.items.map((i) => i.key)).size).toBe(t.items.length);
      for (const item of t.items) {
        expect(item).not.toHaveProperty('priceGr');
        expect(t.categories).toContain(item.category);
        expect(fits(item.unit, item.measure), `${t.trade}.${item.key}`).toBe(true);
      }
    },
  );

  it('glazurnik matches the price list from the golden fixture (11 items, Cennik mockup)', () => {
    const g = getTemplate('glazurnik')!;
    expect(g.items.map((i) => i.name)).toEqual([
      'Skucie płytek',
      'Gruntowanie',
      'Hydroizolacja',
      'Płytki standard – ściany',
      'Płytki 60×120 – ściany',
      'Płytki – podłoga',
      'Fugowanie epoksydowe',
      'Listwa / narożnik',
      'Silikonowanie',
      'Stelaż podtynkowy WC',
      'Brodzik walk-in',
    ]);
    expect(g.categories).toEqual(['Przygotowanie', 'Płytki', 'Montaż']);
  });

  it('getTemplate returns undefined for unknown trades', () => {
    expect(getTemplate('astronauta')).toBeUndefined();
  });

  it('default rules match the Cennik mockup', () => {
    expect(DEFAULT_RULES.map((r) => r.label)).toEqual([
      'Mozaika i drobne formaty',
      'Wysokość powyżej 3 m',
      'Minimalna kwota zlecenia',
      'Dojazd poza miasto',
      'Materiał wykonawcy – narzut',
    ]);
  });
});

describe('onboardingItems', () => {
  it('merges trades in order, dedupes by name and namespaces keys', () => {
    const items = onboardingItems(['hydraulik', 'glazurnik']);
    const names = items.map((i) => i.name);
    expect(names.filter((n) => n === 'Stelaż podtynkowy WC')).toHaveLength(1);
    expect(items[0]!.templateKey).toBe(templateKey('hydraulik', 'punkt_wodkan'));
    expect(items.find((i) => i.name === 'Skucie płytek')!.trade).toBe('glazurnik');
  });

  it('ignores unknown trades (e.g. „Inna profesja”)', () => {
    expect(onboardingItems(['inna'])).toEqual([]);
  });
});
