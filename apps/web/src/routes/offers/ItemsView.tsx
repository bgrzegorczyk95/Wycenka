import {
  formatPLN,
  formatQty,
  parsePLN,
  type OfferDetail,
  type PricedItem,
  type PricingWarning,
} from '@wycenka/core';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { Notice, Select, TextInput } from '../../components/fields';
import { Modal } from '../../components/Modal';
import { PriceInput } from '../../components/PriceInput';
import { errorMessage } from '../../lib/api';
import { useOfferMutations } from '../../lib/offers';
import { metres } from '../../lib/price';
import { AddItemDialog, GeometryDialog, ItemEditDialog } from './itemDialogs';

type Mutations = ReturnType<typeof useOfferMutations>;

function sourceLine(item: PricedItem): string {
  switch (item.sourceKind) {
    case 'transcript':
      return item.sourceQuote ? `z nagrania: „${item.sourceQuote}”` : 'z nagrania';
    case 'ai_answer':
      return 'z odpowiedzi na pytanie AI';
    case 'manual':
      return 'dodana ręcznie';
    case 'rule':
      return 'z zasad cennika';
  }
}

const recording = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}`;

/** „3,0 × 2,0 m, wysokość 2,6 m · ściany 24,4 m² (po odjęciu drzwi) · podłoga 6,0 m²” */
function geometryLine(g: OfferDetail['geometry'][number]): string {
  const parts: string[] = [];
  if (g.lengthMm !== null && g.widthMm !== null) {
    parts.push(
      `${metres(g.lengthMm)} × ${metres(g.widthMm)} m${g.heightMm !== null ? `, wysokość ${metres(g.heightMm)} m` : ''}`,
    );
  } else {
    parts.push('brak wymiarów – dotknij, żeby wpisać');
  }
  if (g.wallsQtyMilli !== null) {
    parts.push(
      `ściany ${formatQty(g.wallsQtyMilli, 'm2')} (po odjęciu ${g.assumedDefaultDoor ? 'drzwi' : 'otworów'})`,
    );
  }
  if (g.floorQtyMilli !== null) parts.push(`podłoga ${formatQty(g.floorQtyMilli, 'm2')}`);
  return parts.join(' · ');
}

function Warnings({ warnings }: { warnings: PricingWarning[] }) {
  if (!warnings.length) return null;
  return (
    <ul className="m-0 mt-1.5 list-none p-0">
      {warnings.map((w, i) => (
        <li key={i} className="flex items-start gap-1.5 text-[13px] text-warn">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          {w.message}
        </li>
      ))}
    </ul>
  );
}

function MissingPriceCard({
  item,
  mutations,
  warnings,
}: {
  item: PricedItem;
  mutations: Mutations;
  warnings: PricingWarning[];
}) {
  const [price, setPrice] = useState('');
  const [save, setSave] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function commit(value: string) {
    if (value.trim() === '') return;
    const unitPriceGr = parsePLN(value);
    if (unitPriceGr === null) return setError('Wpisz cenę, np. 900 albo 900,50.');
    setError(null);
    try {
      await mutations.patchItem.mutateAsync({ key: item.key, patch: { unitPriceGr, saveToPriceList: save } });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <li className="rounded-[14px] border-2 border-warn-line bg-warn-bg px-4 py-3.5">
      <p className="m-0 flex items-center gap-2 text-[13px] font-semibold tracking-[0.6px] text-warn uppercase">
        <AlertTriangle size={18} aria-hidden /> Brak w cenniku
      </p>
      <p className="m-0 mt-1.5 text-[17px] font-semibold">{item.name}</p>
      <p className="m-0 text-[13px] text-warn italic">{sourceLine(item)}</p>
      <label htmlFor={`price-${item.key}`} className="mt-2.5 block text-[13px] font-semibold text-warn">
        Cena netto (zł) {item.qtyMilli !== 1000 && `· ${formatQty(item.qtyMilli, item.unit)}`}
      </label>
      <div className="mt-1.5 flex items-center gap-3">
        <PriceInput
          id={`price-${item.key}`}
          label={`Cena netto: ${item.name}`}
          value={price}
          onValueChange={setPrice}
          dashedWhenEmpty={false}
          placeholder="wpisz cenę"
          onBlur={(e) => void commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void commit(e.currentTarget.value);
            }
          }}
          className="min-h-[52px] flex-1 border-warn-line text-left"
        />
        <label className="flex items-center gap-2 text-[13px] leading-4 text-ink-2">
          <input
            type="checkbox"
            checked={save}
            onChange={(e) => setSave(e.target.checked)}
            className="size-[18px] accent-[#1D4ED8]"
          />
          Zapisz w cenniku
        </label>
      </div>
      {error && <p className="m-0 mt-1 text-[13px] text-accent">{error}</p>}
      <Warnings warnings={warnings} />
    </li>
  );
}

function TitleDialog({
  offer,
  open,
  onClose,
  mutations,
}: {
  offer: OfferDetail;
  open: boolean;
  onClose: () => void;
  mutations: Mutations;
}) {
  const [title, setTitle] = useState(offer.title);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal open={open} onClose={onClose} title="Tytuł oferty">
      <form
        className="flex flex-col gap-3.5 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          mutations.patch.mutate(
            { title },
            { onSuccess: onClose, onError: (err) => setError(errorMessage(err)) },
          );
        }}
      >
        <TextInput
          aria-label="Tytuł oferty"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" variant="dark" size="main" disabled={mutations.patch.isPending}>
          Zapisz
        </Button>
      </form>
    </Modal>
  );
}

/** Screen 3 (Pozycje). */
export function ItemsView({ offer }: { offer: OfferDetail }) {
  const mutations = useOfferMutations(offer.id);
  const navigate = useNavigate();
  const [editing, setEditing] = useState<PricedItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [geometryOpen, setGeometryOpen] = useState(false);
  const [titleOpen, setTitleOpen] = useState(false);
  const [numberAnswer, setNumberAnswer] = useState<Record<string, string>>({});
  const t = offer.totals;
  const error = [mutations.answer, mutations.patch, mutations.process].find((m) => m.error)?.error;

  const openQuestions = offer.questions.filter((q) => q.answer === null);
  const answered = offer.questions.filter((q) => q.answer !== null);
  const warningsFor = (key: string) => offer.warnings.filter((w) => w.itemKey === key);
  const roomWarnings = offer.warnings.filter((w) => !w.itemKey);
  const hasSummary = offer.recordingMs !== null || offer.geometry.length > 0 || answered.length > 0;

  return (
    <div className="flex flex-col gap-3 px-5 pb-6 lg:max-w-[720px] lg:px-0">
      <Link to="/oferty" className="min-h-11 pt-3 text-sm font-medium text-muted">
        ‹ Oferty
      </Link>
      <div>
        <button type="button" onClick={() => setTitleOpen(true)} className="text-left">
          <h1 className="m-0 font-display text-[34px] leading-tight font-bold tracking-[-0.5px]">
            {offer.title}
          </h1>
        </button>
        {offer.client && (
          <p className="m-0 text-[17px] text-muted">
            {[offer.client.name, offer.client.address].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {offer.processingError && (
        <Notice tone="error">
          Nie udało się przygotować oferty z nagrania. Uzupełnij pozycje ręcznie albo{' '}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => mutations.process.mutate()}
          >
            spróbuj ponownie
          </button>
          .
        </Notice>
      )}

      {hasSummary && (
        <button
          type="button"
          onClick={() => offer.geometry.length && setGeometryOpen(true)}
          className="rounded-field bg-sand px-4 py-3 text-left text-[15px] leading-[22px] text-ink-2"
        >
          {offer.recordingMs !== null && (
            <span className="block font-semibold text-ink">Z nagrania {recording(offer.recordingMs)}</span>
          )}
          {offer.geometry.map((g) => (
            <span key={g.roomId} className="block">
              {offer.geometry.length > 1 && <strong>{g.name}: </strong>}
              {geometryLine(g)}
            </span>
          ))}
          {answered.map((q) => (
            <span key={q.id} className="block">
              Pytanie AI: „{q.text}” · Ty: <strong className="text-ink">{q.answer}</strong>
            </span>
          ))}
        </button>
      )}
      <Warnings warnings={roomWarnings} />

      {openQuestions.map((q) => (
        <section key={q.id} className="rounded-card border-2 border-accent bg-accent-tint p-4">
          <p className="m-0 text-[13px] font-semibold text-accent uppercase">Pytanie AI</p>
          <p className="m-0 mt-1 text-[17px] font-semibold">{q.text}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {q.kind === 'number' ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = numberAnswer[q.id]?.trim();
                  if (v) mutations.answer.mutate({ [q.id]: v });
                }}
              >
                <TextInput
                  aria-label={q.text}
                  inputMode="decimal"
                  className="w-28"
                  value={numberAnswer[q.id] ?? ''}
                  onChange={(e) => setNumberAnswer((a) => ({ ...a, [q.id]: e.target.value }))}
                />
                {q.unit && <span className="self-center text-muted">{q.unit}</span>}
                <Button type="submit" variant="dark" disabled={mutations.answer.isPending}>
                  OK
                </Button>
              </form>
            ) : (
              (q.options ?? ['Tak', 'Nie']).map((o) => (
                <Button
                  key={o}
                  variant="secondary"
                  className="min-w-20"
                  disabled={mutations.answer.isPending}
                  onClick={() => mutations.answer.mutate({ [q.id]: o })}
                >
                  {o}
                </Button>
              ))
            )}
          </div>
        </section>
      ))}

      {error && <Notice tone="error">{errorMessage(error)}</Notice>}

      <h2 className="m-0 mt-2 text-[13px] font-semibold tracking-[0.8px] text-muted uppercase">
        Pozycje ({offer.items.length})
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {offer.items.map((item) =>
          item.missingPrice ? (
            <MissingPriceCard
              key={item.key}
              item={item}
              mutations={mutations}
              warnings={warningsFor(item.key)}
            />
          ) : (
            <li key={item.key}>
              <button
                type="button"
                disabled={item.sourceKind === 'rule'}
                onClick={() => setEditing(item)}
                className="block w-full rounded-[14px] border border-line bg-surface px-4 py-3.5 text-left hover:border-ink-2 disabled:hover:border-line"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="text-[17px] font-semibold">{item.name}</span>
                  <span className="text-[17px] font-semibold whitespace-nowrap">
                    {item.valueGr === null ? '—' : formatPLN(item.valueGr)}
                  </span>
                </span>
                <span className="block text-[15px] text-ink-2">
                  {formatQty(item.qtyMilli, item.unit)} × {formatPLN(item.unitPriceGr!)}
                  {item.surchargeBps > 0 && ' + dopłata'}
                </span>
                <span className="block text-[13px] text-muted italic">{sourceLine(item)}</span>
                <Warnings warnings={warningsFor(item.key)} />
              </button>
            </li>
          ),
        )}
      </ul>
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="min-h-[52px] rounded-[14px] border border-dashed border-[#B9B1A2] text-[15px] font-medium text-ink-2"
      >
        + Dodaj pozycję
      </button>

      <p className="m-0 mt-2 text-[15px] font-semibold text-ink-2">Materiał</p>
      <div
        className="grid grid-cols-2 overflow-hidden rounded-[14px] border border-line-strong bg-surface"
        role="radiogroup"
      >
        {(
          [
            ['client', 'Materiał klienta'],
            ['contractor', 'Z moim materiałem'],
          ] as const
        ).map(([value, label]) => {
          const on = offer.material === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => !on && mutations.patch.mutate({ material: value })}
              className={`flex min-h-[52px] items-center justify-center gap-2 text-[15px] font-semibold ${on ? 'bg-ink text-white' : 'text-ink'}`}
            >
              <span
                className={`size-4 rounded-full border-2 ${on ? 'border-[#4F8BFF] bg-white ring-2 ring-[#4F8BFF] ring-inset' : 'border-muted'}`}
              />
              {label}
            </button>
          );
        })}
      </div>

      <section className="mt-2 rounded-card border border-line bg-surface px-5 py-4 text-[15px]">
        <div className="flex justify-between py-1">
          {/* „bez 1 pozycji”, „bez 3 pozycji” – genitive is the same for every count */}
          <span>Netto{t.missingPriceCount > 0 && ` (bez ${t.missingPriceCount} pozycji)`}</span>
          <span>{formatPLN(t.netGr)}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <label className="flex items-center gap-2">
            Rabat
            <select
              aria-label="Rabat"
              value={offer.discountBps ?? 0}
              onChange={(e) => mutations.patch.mutate({ discountBps: Number(e.target.value) || null })}
              className="min-h-9 rounded-[8px] border border-line-strong bg-surface px-1.5 text-sm"
            >
              {[0, 500, 1000, 1500, 2000].map((b) => (
                <option key={b} value={b}>
                  {b === 0 ? 'brak' : `${b / 100}%`}
                </option>
              ))}
            </select>
          </label>
          <span>{t.discountGr > 0 ? `−${formatPLN(t.discountGr)}` : '—'}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <label className="flex items-center gap-2">
            VAT
            <Select
              aria-label="Stawka VAT"
              value={offer.vatBps === null ? 'zw' : String(offer.vatBps)}
              onChange={(e) =>
                mutations.patch.mutate({
                  vatBps: e.target.value === 'zw' ? null : (Number(e.target.value) as 800 | 2300),
                })
              }
              className="min-h-9 w-auto rounded-[8px] px-1.5 text-sm"
            >
              <option value="800">8%</option>
              <option value="2300">23%</option>
              <option value="zw">zw.</option>
            </Select>
          </label>
          <span>{formatPLN(t.vatGr)}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-[19px] font-bold">Brutto</span>
          <span className="text-[24px] font-bold">{formatPLN(t.grossGr)}</span>
        </div>
        {t.missingPriceCount > 0 && (
          <p className="m-0 mt-2 text-sm text-accent">
            Uzupełnij ceny pozycji „Brak w cenniku”, zanim wyślesz ofertę.
          </p>
        )}
        {t.missingPriceCount === 0 && !t.canSend && (
          <p className="m-0 mt-2 text-sm text-accent">Dodaj pozycje z ceną, zanim wyślesz ofertę.</p>
        )}
      </section>

      <div className="sticky bottom-[76px] -mx-5 bg-bg px-5 pt-3 pb-4 lg:static lg:mx-0 lg:bg-transparent lg:px-0">
        <Button size="main" disabled={!t.canSend} onClick={() => navigate(`/oferty/${offer.id}/wysylka`)}>
          Dalej: podgląd i wysyłka
        </Button>
      </div>

      <ItemEditDialog item={editing} onClose={() => setEditing(null)} mutations={mutations} />
      <AddItemDialog open={adding} onClose={() => setAdding(false)} mutations={mutations} />
      <GeometryDialog
        offer={offer}
        open={geometryOpen}
        onClose={() => setGeometryOpen(false)}
        mutations={mutations}
      />
      <TitleDialog offer={offer} open={titleOpen} onClose={() => setTitleOpen(false)} mutations={mutations} />
    </div>
  );
}
