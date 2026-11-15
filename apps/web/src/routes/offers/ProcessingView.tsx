import type { OfferDetail } from '@wycenka/core';
import { Check, Loader2 } from 'lucide-react';
import { Link } from 'react-router';

const STEPS = [
  { step: 'uploaded', label: 'Nagranie i zdjęcia wysłane' },
  { step: 'transcribed', label: 'Rozpoznano tekst nagrania' },
  { step: 'matched', label: 'Dopasowuję pozycje do cennika' },
  { step: 'priced', label: 'Liczę metraże i ceny' },
] as const;

/** Screen 17 (Przetwarzanie). The query polls every 2 s and switches to the items screen when ready. */
export function ProcessingView({ offer }: { offer: OfferDetail }) {
  const current = STEPS.findIndex((s) => s.step === offer.processingStep);
  return (
    <div className="flex flex-col gap-4 px-5 pb-6 lg:max-w-[560px] lg:px-0">
      <Link to="/oferty" className="min-h-11 pt-3 text-sm font-medium text-muted">
        ‹ Oferty
      </Link>
      <div>
        <h1 className="m-0 font-display text-[28px] font-bold tracking-[-0.5px]">{offer.title}</h1>
        {offer.client && <p className="m-0 text-[15px] text-muted">{offer.client.name}</p>}
      </div>
      <section className="rounded-card border border-line bg-surface p-5" aria-live="polite">
        <h2 className="m-0 font-display text-[22px] font-bold">Układam ofertę…</h2>
        <p className="m-0 mt-1 text-[15px] text-ink-2">
          To zajmuje chwilę. Możesz zamknąć aplikację – damy znać, gdy pozycje będą gotowe.
        </p>
        <ol className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
          {STEPS.map((s, i) => {
            // processingStep = last finished step; the next one is in progress.
            const finished = i <= current;
            const active = i === current + 1;
            return (
              <li
                key={s.step}
                className={`flex items-center gap-3 text-[15px] ${finished || active ? 'text-ink' : 'text-muted'}`}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                    finished
                      ? 'bg-success-bg text-success'
                      : active
                        ? 'bg-accent-tint text-accent'
                        : 'bg-sand'
                  }`}
                >
                  {finished ? (
                    <Check size={16} aria-hidden />
                  ) : active ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                  ) : null}
                </span>
                {s.label}
              </li>
            );
          })}
        </ol>
      </section>
      {offer.transcript && (
        <section className="rounded-card bg-sand p-4">
          <h2 className="m-0 text-[13px] font-semibold tracking-[0.8px] text-muted uppercase">
            Co usłyszałem
          </h2>
          <p className="m-0 mt-2 text-[15px] leading-[22px] text-ink-2 italic">„{offer.transcript}”</p>
        </section>
      )}
    </div>
  );
}
