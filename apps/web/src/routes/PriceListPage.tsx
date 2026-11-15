import {
  formatPLNShort,
  normalizeForQuote,
  unitLabel,
  type PriceListEntry,
  type PriceListResponse,
} from '@wycenka/core';
import { Download, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { buttonClass } from '../components/buttonClass';
import { Notice, TextInput } from '../components/fields';
import { FullPageMessage } from '../components/guards';
import { PageHeader } from '../components/PageHeader';
import { usePriceList } from '../lib/priceList';
import { useMe } from '../lib/session';
import { DESKTOP_QUERY, pluralPl, useMediaQuery } from '../lib/useMediaQuery';
import { ItemDialog } from './priceList/ItemDialog';
import { PriceCell } from './priceList/PriceCell';
import { RulesCard } from './priceList/RulesCard';

const IMPORT_SOON = 'Import cennika będzie dostępny wkrótce. Na razie dodawaj pozycje ręcznie.';

function NewBadge({ long }: { long?: boolean }) {
  return (
    <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-accent">
      {long ? 'nowa z oferty' : 'nowa'}
    </span>
  );
}

function CategoryChips({
  categories,
  value,
  onChange,
}: {
  categories: string[];
  value: string | null;
  onChange: (c: string | null) => void;
}) {
  if (categories.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Kategorie">
      {[null, ...categories].map((c) => {
        const active = value === c;
        return (
          <button
            key={c ?? '*'}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(c)}
            className={`min-h-11 rounded-full px-4 text-[15px] lg:min-h-9 lg:text-sm ${
              active ? 'bg-ink font-semibold text-white' : 'border border-line-strong bg-surface text-ink-2'
            }`}
          >
            {c ?? 'Wszystkie'}
          </button>
        );
      })}
    </div>
  );
}

function OtherTradesCard({ hidden }: { hidden: boolean }) {
  const navigate = useNavigate();
  if (hidden) return null;
  return (
    <section className="flex flex-col gap-2 rounded-card border border-dashed border-[#C9C2B4] p-[18px]">
      <h2 className="m-0 text-base font-semibold">Robisz też inne prace?</h2>
      <p className="m-0 text-sm leading-5 text-ink-2">
        Dodaj szablon innej branży, np. malarza albo suchych zabudów. Dostaniesz listę prac bez cen.
      </p>
      <Button variant="secondary" className="self-start" onClick={() => navigate('/cennik/branza')}>
        Wybierz branżę
      </Button>
    </section>
  );
}

export function PriceListPage() {
  const { data, isPending, isError, refetch } = usePriceList();
  if (isPending) return <FullPageMessage>Wczytywanie cennika…</FullPageMessage>;
  if (isError)
    return (
      <FullPageMessage>
        <button type="button" className="min-h-11 underline" onClick={() => void refetch()}>
          Nie udało się wczytać cennika. Spróbuj ponownie
        </button>
      </FullPageMessage>
    );
  return <PriceList data={data} />;
}

function PriceList({ data }: { data: PriceListResponse }) {
  const { data: me } = useMe();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; item: PriceListEntry | null }>({
    open: false,
    item: null,
  });
  const [importInfo, setImportInfo] = useState(false);

  const categories = useMemo(() => [...new Set(data.items.map((i) => i.category))], [data.items]);
  const activeCategory = category !== null && categories.includes(category) ? category : null;
  const needle = normalizeForQuote(query);
  const visible = data.items.filter(
    (i) =>
      (activeCategory === null || i.category === activeCategory) &&
      (needle === '' || normalizeForQuote(`${i.name} ${i.offerName ?? ''}`).includes(needle)),
  );
  const groups = categories
    .map((c) => [c, visible.filter((i) => i.category === c)] as const)
    .filter(([, items]) => items.length > 0);

  const count = data.items.length;
  const tradeLabels = data.trades.map((t) => t.label).join(', ');
  const summary = [tradeLabels, `${count} ${pluralPl(count, 'pozycja', 'pozycje', 'pozycji')}`]
    .filter(Boolean)
    .join(' · ');
  const allTradesAdded = (me?.company.trades.length ?? 0) >= 8;

  const openNew = () => setDialog({ open: true, item: null });
  const openItem = (item: PriceListEntry) => setDialog({ open: true, item });

  const search = (
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
        className="rounded-field pl-10 lg:min-h-10"
      />
    </label>
  );

  const banners = data.recentFromOffers.map((r) => (
    <div
      key={r.itemId}
      className="rounded-[14px] border border-[#F2CDB8] bg-accent-tint px-4 py-3 text-[15px]"
    >
      <p className="m-0 font-semibold">Dodano z oferty „{r.offerLabel}”</p>
      <p className="m-0 text-ink-2">
        {r.name} · {formatPLNShort(r.priceGr)}/{unitLabel(r.unit)}
      </p>
    </div>
  ));

  const empty =
    count === 0 ? (
      <p className="m-0 py-6 text-center text-[15px] text-muted">
        Cennik jest pusty. Dodaj pierwszą pozycję.
      </p>
    ) : visible.length === 0 ? (
      <p className="m-0 py-6 text-center text-[15px] text-muted">Nic nie znaleziono.</p>
    ) : null;

  const itemDialog = (
    <ItemDialog
      open={dialog.open}
      item={dialog.item}
      categories={categories}
      defaultCategory={activeCategory ?? undefined}
      onClose={() => setDialog((d) => ({ ...d, open: false }))}
    />
  );

  if (desktop) {
    return (
      <>
        <header className="flex flex-wrap items-end justify-between gap-4 pb-5">
          <div>
            <h1 className="m-0 font-display text-[34px] leading-tight font-bold tracking-[-0.5px]">Cennik</h1>
            <p className="m-0 mt-1 text-sm text-muted">{summary} · ceny netto</p>
          </div>
          <div className="flex gap-2">
            <Button variant="dark" onClick={openNew}>
              <Plus size={16} aria-hidden /> Dodaj pozycję
            </Button>
            <Button variant="secondary" onClick={() => setImportInfo(true)}>
              Importuj
            </Button>
            <a href="/api/price-list/export.xlsx" download className={buttonClass('secondary')}>
              <Download size={16} aria-hidden /> Eksport do Excela
            </a>
          </div>
        </header>
        {importInfo && (
          <div className="mb-4">
            <Notice tone="success">{IMPORT_SOON}</Notice>
          </div>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-5">
          <div className="flex flex-col gap-4">
            {banners}
            <section className="rounded-card border border-line bg-surface px-5 pt-4 pb-2">
              <div className="flex flex-wrap items-center gap-3 pb-3">
                <div className="w-64">{search}</div>
                <CategoryChips categories={categories} value={activeCategory} onChange={setCategory} />
              </div>
              {empty ?? (
                <table className="w-full border-collapse text-[15px]">
                  <thead>
                    <tr className="text-left text-xs font-semibold tracking-[0.8px] text-muted uppercase">
                      <th className="border-b border-line py-3 font-semibold">Pozycja</th>
                      <th className="border-b border-line py-3 font-semibold">Kategoria</th>
                      <th className="border-b border-line py-3 font-semibold">Jednostka</th>
                      <th className="border-b border-line py-3 text-right font-semibold">Cena netto (zł)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.flatMap(([, items]) =>
                      items.map((item) => (
                        <tr key={item.id} className="border-b border-[#EEEAE2] last:border-b-0">
                          <td className="py-1.5 pr-3">
                            <button
                              type="button"
                              onClick={() => openItem(item)}
                              className="flex min-h-11 items-center gap-2 text-left hover:underline"
                            >
                              {item.name}
                              {item.isNew && <NewBadge long />}
                            </button>
                          </td>
                          <td className="py-1.5 pr-3 text-muted">{item.category}</td>
                          <td className="py-1.5 pr-3 text-muted">{unitLabel(item.unit)}</td>
                          <td className="py-1.5">
                            <PriceCell item={item} />
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              )}
            </section>
          </div>
          <div className="flex flex-col gap-4">
            <RulesCard rules={data.rules} compact />
            <OtherTradesCard hidden={allTradesAdded} />
          </div>
        </div>
        {itemDialog}
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow={summary} title="Cennik" />
      <div className="flex flex-col gap-3 px-5 pb-6">
        {search}
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="dark" className="min-h-[52px] rounded-field text-base" onClick={openNew}>
            + Dodaj pozycję
          </Button>
          <Button
            variant="secondary"
            className="min-h-[52px] rounded-field text-base"
            onClick={() => setImportInfo(true)}
          >
            Importuj
          </Button>
        </div>
        {importInfo && <Notice tone="success">{IMPORT_SOON}</Notice>}
        {banners}
        <CategoryChips categories={categories} value={activeCategory} onChange={setCategory} />

        {empty}
        {groups.map(([cat, items]) => (
          <section key={cat} className="flex flex-col gap-2">
            <h2 className="m-0 mt-2 text-[13px] font-semibold tracking-[0.8px] text-muted uppercase">
              {cat}
            </h2>
            <ul className="m-0 list-none rounded-card border border-line bg-surface px-4 py-0">
              {items.map((item) => (
                <li key={item.id} className="border-b border-[#EEEAE2] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className="flex min-h-[56px] w-full items-center justify-between gap-3 py-2 text-left text-[17px]"
                  >
                    <span className="flex items-center gap-2">
                      {item.name}
                      {item.isNew && <NewBadge />}
                    </span>
                    <span className="whitespace-nowrap">
                      <strong className="font-semibold">{formatPLNShort(item.priceGr)}</strong>
                      <span className="text-muted"> / {unitLabel(item.unit)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="mt-3 flex flex-col gap-3">
          <RulesCard rules={data.rules} />
          <OtherTradesCard hidden={allTradesAdded} />
          <a href="/api/price-list/export.xlsx" download className={`${buttonClass('secondary')} self-start`}>
            <Download size={16} aria-hidden /> Eksport do Excela
          </a>
        </div>
      </div>
      {itemDialog}
    </>
  );
}
