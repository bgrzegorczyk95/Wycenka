import { parsePLN, unitLabel, type OnboardingRatesResponse, type Unit } from '@wycenka/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, FileText, Mic, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { Group, Notice, Select, TextInput } from '../../components/fields';
import { FullPageMessage } from '../../components/guards';
import { OnboardingShell } from '../../components/OnboardingShell';
import { api, errorMessage } from '../../lib/api';
import { ME_KEY, RATES_KEY } from '../../lib/session';

const UNITS: Unit[] = ['m2', 'mb', 'szt', 'kpl', 'h'];

/** Grosze → text in the price field („45”, „45,5”). */
function priceText(gr: number | null): string {
  if (gr === null) return '';
  const zl = Math.trunc(gr / 100);
  const cents = gr % 100;
  return cents === 0 ? String(zl) : `${zl},${String(cents).padStart(2, '0').replace(/0$/, '')}`;
}

interface CustomRow {
  id: number;
  name: string;
  unit: Unit;
  price: string;
}

export function RatesPage() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: RATES_KEY,
    queryFn: () => api<OnboardingRatesResponse>('/api/onboarding/rates'),
  });
  if (isPending) return <FullPageMessage>Wczytywanie…</FullPageMessage>;
  if (isError)
    return (
      <FullPageMessage>
        <button type="button" className="min-h-11 underline" onClick={() => void refetch()}>
          Nie udało się wczytać listy prac. Spróbuj ponownie
        </button>
      </FullPageMessage>
    );
  return <RatesForm data={data} />;
}

function RatesForm({ data }: { data: OnboardingRatesResponse }) {
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.items.map((i) => [i.templateKey, priceText(i.priceGr)])),
  );
  const [custom, setCustom] = useState<CustomRow[]>(() =>
    data.custom.map((c, id) => ({ id, name: c.name, unit: c.unit, price: priceText(c.priceGr) })),
  );
  const [nextId, setNextId] = useState(data.custom.length);
  const [error, setError] = useState<string | null>(null);
  const [importInfo, setImportInfo] = useState(false);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const categories = useMemo(() => {
    const map = new Map<string, OnboardingRatesResponse['items']>();
    for (const item of data.items) map.set(item.category, [...(map.get(item.category) ?? []), item]);
    return [...map.entries()];
  }, [data.items]);

  const invalid = (text: string) => text.trim() !== '' && parsePLN(text) === null;
  const filled = data.items.filter((i) => parsePLN(prices[i.templateKey] ?? '') !== null).length;
  const tradeLabel = data.trades.map((t) => t.label).join(', ');

  async function save() {
    const badTemplate = data.items.some((i) => invalid(prices[i.templateKey] ?? ''));
    const badCustom = custom.some((c) => c.name.trim() === '' || parsePLN(c.price) === null);
    if (badTemplate || badCustom) {
      return setError(
        badCustom
          ? 'Uzupełnij nazwę i cenę własnej pozycji albo ją usuń.'
          : 'Popraw zaznaczone ceny – wpisz kwotę, np. 45 albo 45,50.',
      );
    }
    setBusy(true);
    setError(null);
    try {
      await api('/api/onboarding/rates', {
        method: 'POST',
        body: {
          items: data.items.map((i) => ({
            templateKey: i.templateKey,
            priceGr: parsePLN(prices[i.templateKey] ?? ''),
          })),
          custom: custom.map((c) => ({ name: c.name.trim(), unit: c.unit, priceGr: parsePLN(c.price)! })),
        },
      });
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
      await queryClient.invalidateQueries({ queryKey: RATES_KEY });
      navigate('/start/firma');
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  const priceInput = (id: string, value: string, onChange: (v: string) => void, label: string) => (
    <input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="decimal"
      autoComplete="off"
      aria-label={`Cena netto: ${label}`}
      aria-invalid={invalid(value) || undefined}
      placeholder="—"
      className={`min-h-11 w-[84px] rounded-[10px] px-2.5 text-right text-[15px] font-medium text-ink placeholder:text-muted focus:border-solid focus:border-ink focus:bg-surface focus:outline-none ${
        invalid(value)
          ? 'border border-accent'
          : value.trim() === ''
            ? 'border border-dashed border-[#B9B1A2] bg-[#FAF8F4]'
            : 'border border-line-strong'
      }`}
    />
  );

  return (
    <OnboardingShell
      step={2}
      eyebrow={
        <Link to="/start/profesja" className="text-muted">
          Krok 2 z 3{tradeLabel ? ` · ${tradeLabel}` : ''}
        </Link>
      }
      title="Wpisz swoje stawki"
      description="Ceny netto. Puste pozycje nie trafią do cennika – uzupełnisz je później."
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="dark" size="main" disabled={busy} onClick={() => void save()}>
            Zapisz i przejdź dalej
          </Button>
          <p className="m-0 text-center text-xs text-muted">Krok 3: dane firmy i logo</p>
        </div>
      }
    >
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
                {priceInput(
                  item.templateKey,
                  prices[item.templateKey] ?? '',
                  (v) => setPrices((p) => ({ ...p, [item.templateKey]: v })),
                  item.name,
                )}
                <span className="w-12 text-[13px] text-muted">zł/{unitLabel(item.unit)}</span>
              </span>
            </div>
          ))}
        </Group>
      ))}

      {data.items.length === 0 && custom.length === 0 && (
        <p className="m-0 text-[15px] text-ink-2">
          Dla Twojej profesji nie mamy gotowej listy prac. Dodaj swoje pozycje z cenami.
        </p>
      )}

      {custom.length > 0 && (
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
                {priceInput(
                  `custom-${row.id}`,
                  row.price,
                  (v) => update({ price: v }),
                  row.name || 'własna pozycja',
                )}
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

      {error && <Notice tone="error">{error}</Notice>}
    </OnboardingShell>
  );
}
