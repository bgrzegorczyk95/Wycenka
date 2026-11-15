import { TRADES, type OnboardingRatesResponse } from '@wycenka/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { Notice } from '../../components/fields';
import { labelClass } from '../../components/fieldClasses';
import { OnboardingShell } from '../../components/OnboardingShell';
import { api, errorMessage } from '../../lib/api';
import { ME_KEY, RATES_KEY, useMe } from '../../lib/session';

export function ProfessionPage() {
  const { data: me } = useMe();
  const [selected, setSelected] = useState<string[]>(me?.company.trades ?? []);
  const [customOpen, setCustomOpen] = useState(!!me?.company.customTrade);
  const [custom, setCustom] = useState(me?.company.customTrade ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const toggle = (trade: string) =>
    setSelected((s) => (s.includes(trade) ? s.filter((t) => t !== trade) : [...s, trade]));

  const canContinue = selected.length > 0 || custom.trim().length > 0;

  async function next() {
    setBusy(true);
    setError(null);
    try {
      // Keep the tile order regardless of click order.
      const trades = TRADES.map((t) => t.trade).filter((t) => selected.includes(t));
      const rates = await api<OnboardingRatesResponse>('/api/onboarding/trades', {
        method: 'POST',
        body: { trades, customTrade: customOpen ? custom : null },
      });
      queryClient.setQueryData(RATES_KEY, rates);
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
      navigate('/start/stawki');
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <OnboardingShell
      step={1}
      title="Czym się zajmujesz?"
      description="Dobierzemy gotową listę prac. Ceny wpiszesz swoje – nie podpowiadamy stawek."
      footer={
        <Button variant="dark" size="main" disabled={!canContinue || busy} onClick={() => void next()}>
          Dalej
        </Button>
      }
    >
      <fieldset className="m-0 border-none p-0">
        <legend className="mb-2.5 text-[13px] font-semibold text-muted">Możesz zaznaczyć kilka</legend>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {TRADES.map((t) => {
            const on = selected.includes(t.trade);
            return (
              <label
                key={t.trade}
                className={`flex min-h-[84px] cursor-pointer flex-col gap-1 rounded-[14px] p-3 ${
                  on ? 'border-2 border-accent bg-accent-tint' : 'border border-[#DDD7CC] bg-surface p-[13px]'
                }`}
              >
                <span className="flex items-center justify-between gap-1.5">
                  <span className="text-[15px] font-semibold">{t.label}</span>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(t.trade)}
                    className="size-[18px] shrink-0 accent-[#1D4ED8]"
                  />
                </span>
                <span className={`text-xs leading-4 ${on ? 'text-ink-2' : 'text-muted'}`}>
                  {t.description}
                </span>
              </label>
            );
          })}
        </div>
        {customOpen ? (
          <div className="mt-2.5 flex flex-col gap-1.5">
            <label htmlFor="custom-trade" className={labelClass}>
              Inna profesja – opisz własnymi słowami
            </label>
            <textarea
              id="custom-trade"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              maxLength={200}
              rows={2}
              autoFocus
              placeholder="np. montaż kominków, cyklinowanie schodów"
              className="w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2.5 text-[15px] focus:border-ink focus:outline-none"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="mt-2.5 min-h-12 w-full rounded-[14px] border border-dashed border-[#B9B1A2] text-sm font-medium text-ink-2"
          >
            Inna profesja – opisz własnymi słowami
          </button>
        )}
      </fieldset>
      {error && <Notice tone="error">{error}</Notice>}
    </OnboardingShell>
  );
}
