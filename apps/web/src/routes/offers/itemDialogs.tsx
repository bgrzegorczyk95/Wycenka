import {
  formatPercent,
  formatPLNShort,
  normalizeForQuote,
  parsePLN,
  priceInputText,
  unitLabel,
  type OfferDetail,
  type PricedItem,
  type PriceListEntry,
  type Unit,
} from '@wycenka/core';
import { Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Field, Notice, Select, TextInput } from '../../components/fields';
import { Modal } from '../../components/Modal';
import { PriceInput } from '../../components/PriceInput';
import { UNITS } from '../../components/useRatesEditor';
import { errorMessage } from '../../lib/api';
import type { useOfferMutations } from '../../lib/offers';
import { parseQty, qtyInputText } from '../../lib/price';
import { usePriceList } from '../../lib/priceList';

type Mutations = ReturnType<typeof useOfferMutations>;

/** Tap on an item: name, quantity, price, delete. */
export function ItemEditDialog({
  item,
  onClose,
  mutations,
}: {
  item: PricedItem | null;
  onClose: () => void;
  mutations: Mutations;
}) {
  return (
    <Modal open={item !== null} onClose={onClose} title="Pozycja oferty">
      {item && <ItemEditForm item={item} onClose={onClose} mutations={mutations} />}
    </Modal>
  );
}

function ItemEditForm({
  item,
  onClose,
  mutations,
}: {
  item: PricedItem;
  onClose: () => void;
  mutations: Mutations;
}) {
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(qtyInputText(item.qtyMilli));
  const [price, setPrice] = useState(priceInputText(item.unitPriceGr));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const busy = mutations.patchItem.isPending || mutations.removeItem.isPending;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const qtyMilli = parseQty(qty);
    if (name.trim().length < 2) next.name = 'Wpisz nazwę pozycji.';
    if (qtyMilli === null) next.qty = 'Wpisz ilość, np. 12 albo 12,5.';
    const unitPriceGr = price.trim() === '' ? null : parsePLN(price);
    if (price.trim() !== '' && unitPriceGr === null) next.price = 'Wpisz cenę, np. 45 albo 45,50.';
    setErrors(next);
    if (Object.keys(next).length) return;
    const patch: Record<string, unknown> = {};
    if (name.trim() !== item.name) patch.name = name.trim();
    if (qtyMilli !== item.qtyMilli) patch.qtyMilli = qtyMilli;
    if (unitPriceGr !== item.unitPriceGr) patch.unitPriceGr = unitPriceGr;
    try {
      if (Object.keys(patch).length) await mutations.patchItem.mutateAsync({ key: item.key, patch });
      onClose();
    } catch (err) {
      setServerError(errorMessage(err));
    }
  }

  async function remove() {
    try {
      await mutations.removeItem.mutateAsync(item.key);
      onClose();
    } catch (err) {
      setServerError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-3.5 pt-2">
      <Field label="Nazwa na ofercie" htmlFor="oi-name" error={errors.name}>
        <TextInput
          id="oi-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          invalid={!!errors.name}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label={`Ilość (${unitLabel(item.unit)})`} htmlFor="oi-qty" error={errors.qty}>
          <TextInput
            id="oi-qty"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            invalid={!!errors.qty}
            className="text-right"
          />
        </Field>
        <Field label="Cena netto (zł)" htmlFor="oi-price" error={errors.price}>
          <PriceInput
            id="oi-price"
            label="Cena netto (zł)"
            value={price}
            onValueChange={setPrice}
            dashedWhenEmpty={false}
            className="min-h-12 w-full"
          />
        </Field>
      </div>
      {item.surchargeBps > 0 && (
        <p className="m-0 text-[13px] text-muted">
          Do ceny doliczamy dopłaty z cennika (+{formatPercent(item.surchargeBps)}).
        </p>
      )}
      {serverError && <Notice tone="error">{serverError}</Notice>}
      <Button type="submit" variant="dark" size="main" disabled={busy}>
        Zapisz
      </Button>
      <button
        type="button"
        onClick={() => void remove()}
        disabled={busy}
        className="min-h-11 text-[15px] font-medium text-accent underline"
      >
        Usuń z oferty
      </button>
    </form>
  );
}

/** „+ Dodaj pozycję”: from the price list (with search) or an own item. */
export function AddItemDialog({
  open,
  onClose,
  mutations,
}: {
  open: boolean;
  onClose: () => void;
  mutations: Mutations;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Dodaj pozycję">
      <AddItemForm onClose={onClose} mutations={mutations} />
    </Modal>
  );
}

function AddItemForm({ onClose, mutations }: { onClose: () => void; mutations: Mutations }) {
  const { data: priceList } = usePriceList();
  const [tab, setTab] = useState<'list' | 'own'>('list');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<PriceListEntry | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<Unit>('kpl');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const needle = normalizeForQuote(query);
  const items = (priceList?.items ?? []).filter(
    (i) => !needle || normalizeForQuote(`${i.name} ${i.offerName ?? ''}`).includes(needle),
  );

  async function add(e: FormEvent) {
    e.preventDefault();
    const qtyMilli = parseQty(qty);
    if (qtyMilli === null || qtyMilli === 0) return setError('Wpisz ilość, np. 12 albo 12,5.');
    try {
      if (tab === 'list' && picked) {
        await mutations.addItem.mutateAsync({
          priceListItemId: picked.id,
          name: picked.offerName ?? picked.name,
          unit: picked.unit,
          qtyMilli,
        });
      } else {
        if (name.trim().length < 2) return setError('Wpisz nazwę pozycji.');
        const unitPriceGr = price.trim() === '' ? null : parsePLN(price);
        if (price.trim() !== '' && unitPriceGr === null) return setError('Wpisz cenę, np. 45 albo 45,50.');
        await mutations.addItem.mutateAsync({
          priceListItemId: null,
          name: name.trim(),
          unit,
          qtyMilli,
          unitPriceGr,
        });
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const tabs = (
    <div className="grid grid-cols-2 rounded-field border border-line-strong bg-surface p-1" role="tablist">
      {(['list', 'own'] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={tab === t}
          onClick={() => {
            setTab(t);
            setPicked(null);
            setError(null);
          }}
          className={`min-h-11 rounded-[9px] text-[15px] font-semibold ${tab === t ? 'bg-ink text-white' : 'text-ink-2'}`}
        >
          {t === 'list' ? 'Z cennika' : 'Własna'}
        </button>
      ))}
    </div>
  );

  return (
    <form onSubmit={(e) => void add(e)} noValidate className="flex flex-col gap-3.5 pt-2">
      {tabs}
      {tab === 'list' && !picked && (
        <>
          <label className="relative block">
            <Search
              size={18}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <TextInput
              type="search"
              aria-label="Szukaj w cenniku"
              placeholder="Szukaj pozycji..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </label>
          <ul className="m-0 max-h-[45dvh] list-none overflow-y-auto rounded-card border border-line bg-surface p-0 px-4">
            {items.map((i) => (
              <li key={i.id} className="border-b border-[#EEEAE2] last:border-b-0">
                <button
                  type="button"
                  onClick={() => {
                    setPicked(i);
                    setQty('1');
                  }}
                  className="flex min-h-[52px] w-full items-center justify-between gap-3 text-left text-[15px]"
                >
                  <span>{i.name}</span>
                  <span className="whitespace-nowrap text-muted">
                    {formatPLNShort(i.priceGr)} / {unitLabel(i.unit)}
                  </span>
                </button>
              </li>
            ))}
            {items.length === 0 && (
              <li className="py-4 text-center text-[15px] text-muted">Nic nie znaleziono.</li>
            )}
          </ul>
        </>
      )}
      {tab === 'list' && picked && (
        <>
          <p className="m-0 text-[15px]">
            <strong>{picked.name}</strong> · {formatPLNShort(picked.priceGr)} / {unitLabel(picked.unit)}
          </p>
          <Field label={`Ilość (${unitLabel(picked.unit)})`} htmlFor="add-qty">
            <TextInput
              id="add-qty"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
          </Field>
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="min-h-11 self-start text-sm text-muted underline"
          >
            Wybierz inną pozycję
          </button>
        </>
      )}
      {tab === 'own' && (
        <>
          <Field label="Nazwa na ofercie" htmlFor="add-name">
            <TextInput
              id="add-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Wywóz gruzu"
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-3 gap-2.5">
            <Field label="Ilość" htmlFor="add-qty-own">
              <TextInput
                id="add-qty-own"
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </Field>
            <Field label="Jednostka" htmlFor="add-unit">
              <Select id="add-unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {unitLabel(u)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Cena (zł)" htmlFor="add-price">
              <PriceInput
                id="add-price"
                label="Cena netto (zł)"
                value={price}
                onValueChange={setPrice}
                className="min-h-12 w-full"
              />
            </Field>
          </div>
          <p className="m-0 text-[13px] text-muted">Bez ceny pozycja będzie oznaczona „Brak w cenniku”.</p>
        </>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {(tab === 'own' || picked) && (
        <Button type="submit" variant="dark" size="main" disabled={mutations.addItem.isPending}>
          Dodaj do oferty
        </Button>
      )}
    </form>
  );
}

/** Correct room dimensions (summary box tap) – re-prices the offer. */
export function GeometryDialog({
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
  return (
    <Modal open={open} onClose={onClose} title="Wymiary">
      <GeometryForm offer={offer} onClose={onClose} mutations={mutations} />
    </Modal>
  );
}

function GeometryForm({
  offer,
  onClose,
  mutations,
}: {
  offer: OfferDetail;
  onClose: () => void;
  mutations: Mutations;
}) {
  // Exact value (up to mm), so saving without changes does not round the dimensions.
  const toText = (mm: number | null) => (mm === null ? '' : qtyInputText(mm));
  const [rooms, setRooms] = useState(() =>
    offer.geometry.map((g) => ({
      id: g.roomId,
      name: g.name,
      l: toText(g.lengthMm),
      w: toText(g.widthMm),
      h: toText(g.heightMm),
    })),
  );
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    const toM = (t: string) => {
      if (t.trim() === '') return null;
      const milli = parseQty(t);
      return milli === null ? Number.NaN : milli / 1000;
    };
    const parsed = rooms.map((r) => ({ id: r.id, lengthM: toM(r.l), widthM: toM(r.w), heightM: toM(r.h) }));
    if (parsed.some((r) => [r.lengthM, r.widthM, r.heightM].some((v) => Number.isNaN(v)))) {
      return setError('Wpisz wymiary w metrach, np. 3 albo 2,6.');
    }
    try {
      await mutations.geometry.mutateAsync({ rooms: parsed });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} noValidate className="flex flex-col gap-4 pt-2">
      {rooms.map((r, i) => {
        const set = (patch: Partial<typeof r>) =>
          setRooms((rs) => rs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
        return (
          <fieldset key={r.id} className="m-0 flex flex-col gap-2 border-none p-0">
            <legend className="mb-1 text-[15px] font-semibold">{r.name}</legend>
            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  ['l', 'Długość (m)'],
                  ['w', 'Szerokość (m)'],
                  ['h', 'Wysokość (m)'],
                ] as const
              ).map(([k, label]) => (
                <Field key={k} label={label} htmlFor={`${r.id}-${k}`}>
                  <TextInput
                    id={`${r.id}-${k}`}
                    inputMode="decimal"
                    value={r[k]}
                    onChange={(e) => set({ [k]: e.target.value })}
                    className="text-right"
                  />
                </Field>
              ))}
            </div>
          </fieldset>
        );
      })}
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="dark" size="main" disabled={mutations.geometry.isPending}>
        Przelicz pozycje
      </Button>
    </form>
  );
}
