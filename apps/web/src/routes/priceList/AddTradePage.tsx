import { TRADES, type OnboardingRatesResponse, type PriceListResponse } from '@wycenka/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../../components/Button';
import { Notice } from '../../components/fields';
import { FullPageMessage } from '../../components/guards';
import { PageHeader } from '../../components/PageHeader';
import { useRatesEditor } from '../../components/useRatesEditor';
import { api, errorMessage } from '../../lib/api';
import { PRICE_LIST_KEY } from '../../lib/priceList';
import { ME_KEY, useMe } from '../../lib/session';

function BackToPriceList() {
  return (
    <Link
      to="/cennik"
      className="inline-flex min-h-11 items-center gap-1.5 px-5 pt-3 text-sm font-medium text-muted lg:px-0"
    >
      <ChevronLeft size={18} aria-hidden /> Cennik
    </Link>
  );
}

/** „Robisz też inne prace?” → choose a trade. */
export function ChooseTradePage() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const available = TRADES.filter((t) => !me?.company.trades.includes(t.trade));

  return (
    <>
      <BackToPriceList />
      <PageHeader title="Dodaj branżę" />
      <div className="flex flex-col gap-3 px-5 pb-6 lg:max-w-[720px] lg:px-0">
        <p className="m-0 text-[15px] text-ink-2">
          Wybierz branżę – dostaniesz listę prac bez cen. Wpisz swoje stawki, puste pozycje pominiemy.
        </p>
        {available.length === 0 ? (
          <p className="m-0 text-[15px] text-muted">Masz już w cenniku wszystkie dostępne branże.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
            {available.map((t) => (
              <button
                key={t.trade}
                type="button"
                onClick={() => navigate(`/cennik/branza/${t.trade}`)}
                className="flex min-h-[84px] flex-col gap-1 rounded-[14px] border border-[#DDD7CC] bg-surface p-3 text-left hover:border-ink"
              >
                <span className="text-[15px] font-semibold">{t.label}</span>
                <span className="text-xs leading-4 text-muted">{t.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function AddTradeRatesPage() {
  const { trade = '' } = useParams();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['price-list', 'template', trade],
    queryFn: () => api<OnboardingRatesResponse>(`/api/price-list/templates/${trade}`),
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
  return <AddTradeRates trade={trade} data={data} />;
}

function AddTradeRates({ trade, data }: { trade: string; data: OnboardingRatesResponse }) {
  const editor = useRatesEditor(data, { allowCustom: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const label = data.trades[0]?.label ?? trade;

  async function save() {
    const result = editor.collect();
    if (!result.ok) return setError(result.message);
    setBusy(true);
    setError(null);
    try {
      const list = await api<PriceListResponse>('/api/price-list/templates', {
        method: 'POST',
        body: { trade, items: result.payload.items },
      });
      queryClient.setQueryData(PRICE_LIST_KEY, list);
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
      navigate('/cennik');
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <>
      <BackToPriceList />
      <PageHeader eyebrow={label} title="Wpisz swoje stawki" />
      <div className="flex flex-col gap-3 px-5 pb-6 lg:max-w-[720px] lg:px-0">
        <p className="m-0 text-sm leading-5 text-ink-2">
          Ceny netto. Puste pozycje nie trafią do cennika – uzupełnisz je później.
        </p>
        {data.items.length === 0 ? (
          <p className="m-0 text-[15px] text-muted">Wszystkie prace z tej branży masz już w cenniku.</p>
        ) : (
          editor.fields
        )}
        {error && <Notice tone="error">{error}</Notice>}
        <Button
          variant="dark"
          size="main"
          disabled={busy || data.items.length === 0}
          onClick={() => void save()}
        >
          Dodaj do cennika
        </Button>
      </div>
    </>
  );
}
