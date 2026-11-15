import type { OnboardingRatesResponse } from '@wycenka/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { Notice } from '../../components/fields';
import { FullPageMessage } from '../../components/guards';
import { OnboardingShell } from '../../components/OnboardingShell';
import { useRatesEditor } from '../../components/useRatesEditor';
import { api, errorMessage } from '../../lib/api';
import { ME_KEY, RATES_KEY } from '../../lib/session';

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
  const editor = useRatesEditor(data, { allowCustom: true });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const tradeLabel = data.trades.map((t) => t.label).join(', ');

  async function save() {
    const result = editor.collect();
    if (!result.ok) return setError(result.message);
    setBusy(true);
    setError(null);
    try {
      await api('/api/onboarding/rates', { method: 'POST', body: result.payload });
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
      await queryClient.invalidateQueries({ queryKey: RATES_KEY });
      navigate('/start/firma');
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

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
      {editor.fields}
      {error && <Notice tone="error">{error}</Notice>}
    </OnboardingShell>
  );
}
