import { parsePLN, priceInputText, unitLabel, type OnboardingRatesResponse, type Unit } from '@wycenka/core';
import { Camera, FileText, Mic, Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Group, Notice, Select, TextInput } from './fields';
import { isInvalidPrice } from '../lib/price';
import { PriceInput } from './PriceInput';

export const UNITS: Unit[] = ['m2', 'mb', 'szt', 'kpl', 'h'];

interface CustomRow {
  id: number;
  name: string;
  unit: Unit;
  price: string;
}

export type RatesPayload = {
  items: { templateKey: string; priceGr: number | null }[];
  custom: { name: string; unit: Unit; priceGr: number }[];
};

/**
 * „Wpisz swoje stawki” editor (Stawki mockup): template items grouped by category with price fields,
 * optional own items, quick-import shortcuts. Used by onboarding step 2 and „Dodaj branżę” in the price list.
 */
export function useRatesEditor(data: OnboardingRatesResponse, { allowCustom }: { allowCustom: boolean }) {
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.items.map((i) => [i.templateKey, priceInputText(i.priceGr)])),
  );
  const [custom, setCustom] = useState<CustomRow[]>(() =>
    data.custom.map((c, id) => ({ id, name: c.name, unit: c.unit, price: priceInputText(c.priceGr) })),
  );
  const [nextId, setNextId] = useState(data.custom.length);
  const [importInfo, setImportInfo] = useState(false);

  const categories = useMemo(() => {
    const map = new Map<string, OnboardingRatesResponse['items']>();
    for (const item of data.items) map.set(item.category, [...(map.get(item.category) ?? []), item]);
    return [...map.entries()];
  }, [data.items]);

  const filled = data.items.filter((i) => parsePLN(prices[i.templateKey] ?? '') !== null).length;

  /** Validates and returns the payload, or a Polish error message. */
  function collect(): { ok: true; payload: RatesPayload } | { ok: false; message: string } {
    if (custom.some((c) => c.name.trim() === '' || parsePLN(c.price) === null)) {
      return { ok: false, message: 'Uzupełnij nazwę i cenę własnej pozycji albo ją usuń.' };
    }
    if (data.items.some((i) => isInvalidPrice(prices[i.templateKey] ?? ''))) {
      return { ok: false, message: 'Popraw zaznaczone ceny – wpisz kwotę, np. 45 albo 45,50.' };
    }
    return {
      ok: true,
      payload: {
        items: data.items.map((i) => ({
          templateKey: i.templateKey,
          priceGr: parsePLN(prices[i.templateKey] ?? ''),
        })),
        custom: custom.map((c) => ({ name: c.name.trim(), unit: c.unit, priceGr: parsePLN(c.price)! })),
      },
    };
  }

  const fields: ReactNode = (
    <>
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Mic, label: 'Powiedz ceny' },
          { icon: Camera, label: 'Zdjęcie kartki' },
          { icon: FileText, label: 'Excel / PDF' },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => setImportInfo(true)}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-field border border-[#DDD7CC] bg-surface text-xs font-semibold"
          >
            <Icon size={20} className="text-accent" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      {importInfo && (
        <Notice tone="success">Import cennika będzie dostępny wkrótce. Na razie wpisz ceny ręcznie.</Notice>
      )}

      {data.items.length > 0 && (
        <p className="m-0 mt-1 text-[13px] font-semibold text-ink-2">
          Uzupełnione: {filled} z {data.items.length}
        </p>
      )}

      {categories.map(([category, items]) => (
        <Group key={category} legend={category} className="pb-1">
          {items.map((item, n) => (
            <div
              key={item.templateKey}
              className={`flex items-center justify-between gap-2.5 py-2 ${n < items.length - 1 ? 'border-b border-[#EEEAE2]' : ''}`}
            >
              <label htmlFor={item.templateKey} className="text-[15px]">
                {item.name}
              </label>
              <span className="flex items-center gap-1.5">
                <PriceInput
                  id={item.templateKey}
                  label={`Cena netto: ${item.name}`}
                  value={prices[item.templateKey] ?? ''}
                  onValueChange={(v) => setPrices((p) => ({ ...p, [item.templateKey]: v }))}
                />
                <span className="w-12 text-[13px] text-muted">zł/{unitLabel(item.unit)}</span>
              </span>
            </div>
          ))}
        </Group>
      ))}

      {allowCustom && data.items.length === 0 && custom.length === 0 && (
        <p className="m-0 text-[15px] text-ink-2">
          Dla Twojej profesji nie mamy gotowej listy prac. Dodaj swoje pozycje z cenami.
        </p>
      )}

      {allowCustom && custom.length > 0 && (
        <Group legend="Własne pozycje" className="flex flex-col gap-3 pt-2">
          {custom.map((row) => {
            const update = (patch: Partial<CustomRow>) =>
              setCustom((rows) => rows.map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
            return (
              <div
                key={row.id}
                className="flex flex-wrap items-center gap-2 border-b border-[#EEEAE2] pb-3 last:border-b-0"
              >
                <TextInput
                  aria-label="Nazwa pozycji"
                  value={row.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="Nazwa, np. Wywóz gruzu"
                  className="min-h-11 flex-[1_1_100%]"
                  autoFocus={row.name === ''}
                />
                <PriceInput
                  id={`custom-${row.id}`}
                  label={`Cena netto: ${row.name || 'własna pozycja'}`}
                  value={row.price}
                  onValueChange={(v) => update({ price: v })}
                />
                <span className="text-[13px] text-muted">zł /</span>
                <Select
                  aria-label="Jednostka"
                  value={row.unit}
                  onChange={(e) => update({ unit: e.target.value as Unit })}
                  className="min-h-11 w-24"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {unitLabel(u)}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  onClick={() => setCustom((rows) => rows.filter((r) => r.id !== row.id))}
                  aria-label="Usuń pozycję"
                  className="ml-auto flex size-11 items-center justify-center rounded-[10px] text-muted hover:bg-bg"
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              </div>
            );
          })}
        </Group>
      )}

      {allowCustom && (
        <button
          type="button"
          onClick={() => {
            setCustom((rows) => [...rows, { id: nextId, name: '', unit: 'm2', price: '' }]);
            setNextId((n) => n + 1);
          }}
          className="min-h-11 rounded-field border border-dashed border-[#B9B1A2] text-sm font-medium text-ink-2"
        >
          + Dodaj własną pozycję
        </button>
      )}
    </>
  );

  return { fields, collect };
}
