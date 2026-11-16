import { useQueryClient } from '@tanstack/react-query';
import { Check, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { Notice } from '../../components/fields';
import { OFFERS_KEY } from '../../lib/offers';
import { useOnline, useWaitingOffers } from '../../offline/autoSync';
import { discardOffer, retryFailed, syncQueue, type WaitingOffer } from '../../offline/queue';
import { mmss } from '../../offline/recorder';

function describe(o: WaitingOffer): string {
  const parts = [];
  if (o.recordingMs > 0) parts.push(`nagranie ${mmss(o.recordingMs)}`);
  if (o.photos > 0)
    parts.push(`${o.photos} ${o.photos === 1 ? 'zdjęcie' : o.photos < 5 ? 'zdjęcia' : 'zdjęć'}`);
  return parts.join(' · ') || 'bez nagrania';
}

/** Screen 18 (Brak zasięgu): what waits on the phone and is sent automatically. */
export function PendingPage() {
  const offers = useWaitingOffers();
  const online = useOnline();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function sendNow() {
    setBusy(true);
    setNotice(null);
    await retryFailed();
    const r = await syncQueue();
    void queryClient.invalidateQueries({ queryKey: OFFERS_KEY });
    setBusy(false);
    if (r.unauthorized) return setNotice('Zaloguj się ponownie, żeby wysłać oferty.');
    if (r.sent.length === 1 && r.pending === 0 && r.failed === 0)
      return navigate(`/oferty/${r.sent[0]!.offerId}`);
    if (r.pending === 0 && r.failed === 0) return navigate('/oferty');
    setNotice(
      online ? 'Nie wszystko udało się wysłać. Spróbujemy ponownie za chwilę.' : 'Nadal brak internetu.',
    );
  }

  const list = offers ?? [];
  return (
    <div className="flex min-h-full flex-1 flex-col">
      {!online && (
        <div className="flex items-center gap-2.5 border-b border-warn-line bg-warn-bg px-5 py-3 text-[15px] font-semibold text-warn">
          <WifiOff size={20} aria-hidden /> Brak internetu
        </div>
      )}
      <div className="flex flex-1 flex-col gap-4 px-5 pt-5 pb-6 lg:max-w-[560px] lg:px-0">
        <section className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-6 py-7 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-success-bg text-success">
            <Check size={30} aria-hidden />
          </span>
          <h1 className="m-0 font-display text-[26px] leading-tight font-bold">
            Nagranie zapisane w telefonie
          </h1>
          <p className="m-0 text-[15px] leading-[22px] text-ink-2">
            Nic nie przepadło. Gdy wróci zasięg, wyślemy je i przygotujemy ofertę. Jeśli aplikacja będzie
            zamknięta, wyślemy przy jej następnym otwarciu.
          </p>
        </section>

        <h2 className="m-0 mt-1 text-[13px] font-semibold tracking-[0.8px] text-muted uppercase">
          Czeka na wysłanie ({list.length})
        </h2>
        {list.length === 0 && offers && (
          <p className="m-0 text-[15px] text-muted">Wszystko zostało wysłane.</p>
        )}
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {list.map((o) => (
            <li key={o.clientUuid} className="rounded-[14px] border border-line bg-surface px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 truncate text-[17px] font-semibold">{o.client.name || 'Oględziny'}</p>
                  <p className="m-0 text-[15px] text-muted">{describe(o)}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    o.status === 'failed' ? 'bg-accent-tint text-accent' : 'bg-warn-bg text-warn'
                  }`}
                >
                  {o.status === 'failed' ? 'Błąd' : 'Czeka'}
                </span>
              </div>
              {o.status === 'failed' && (
                <div className="mt-2 flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-accent">{o.lastError}</span>
                  <button
                    type="button"
                    className="min-h-11 shrink-0 text-muted underline"
                    onClick={() =>
                      window.confirm('Usunąć te oględziny z telefonu?') && void discardOffer(o.clientUuid)
                    }
                  >
                    Usuń
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {notice && <Notice tone="error">{notice}</Notice>}
        <div className="mt-auto flex flex-col gap-2.5 pt-4">
          <Button
            variant="dark"
            size="main"
            disabled={busy || list.length === 0}
            onClick={() => void sendNow()}
          >
            Spróbuj wysłać teraz
          </Button>
          <Button variant="secondary" size="main" onClick={() => navigate('/oferty')}>
            Wróć do ofert
          </Button>
        </div>
      </div>
    </div>
  );
}
