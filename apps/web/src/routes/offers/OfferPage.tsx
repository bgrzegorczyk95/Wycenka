import {
  formatDatePl,
  formatDateTimePl,
  formatPLN,
  formatQty,
  isSentStatus,
  vatLabel,
  type OfferDetail,
  type OfferEvent,
} from '@wycenka/core';
import { ChevronLeft, Copy } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../../components/Button';
import { buttonClass } from '../../components/buttonClass';
import { Notice } from '../../components/fields';
import { FullPageMessage } from '../../components/guards';
import { StatusPill } from '../../components/StatusPill';
import { ApiRequestError, errorMessage } from '../../lib/api';
import { useOffer, useOfferMutations } from '../../lib/offers';
import { ItemsView } from './ItemsView';
import { ProcessingView } from './ProcessingView';

/** /oferty/:id – processing (17), items (3) or the sent offer with its history. */
export function OfferPage() {
  const { id = '' } = useParams();
  const { data: offer, isPending, error } = useOffer(id);
  if (isPending) return <FullPageMessage>Wczytywanie oferty…</FullPageMessage>;
  if (error) {
    return (
      <FullPageMessage>
        {error instanceof ApiRequestError && error.status === 404
          ? 'Nie ma takiej oferty.'
          : errorMessage(error)}
      </FullPageMessage>
    );
  }
  if (offer.status === 'processing') return <ProcessingView offer={offer} />;
  if (isSentStatus(offer.status)) return <SentView offer={offer} />;
  return <ItemsView offer={offer} />;
}

const CHANNEL_LABEL: Record<string, string> = {
  sms: 'SMS-em',
  whatsapp: 'przez WhatsApp',
  email: 'e-mailem',
  link: 'jako link',
};

function eventText(e: OfferEvent): string {
  switch (e.type) {
    case 'created':
      return 'Utworzona';
    case 'processing_started':
      return 'Wysłana do AI';
    case 'processed':
      return 'AI przygotowało pozycje';
    case 'processing_failed':
      return 'Nie udało się przygotować pozycji';
    case 'sent':
      return `Wysłana ${CHANNEL_LABEL[e.channel ?? ''] ?? ''}`.trim();
    case 'opened':
      return 'Otwarta przez klienta';
    case 'question': {
      const p = e.payload as { text?: string; phone?: string | null } | null;
      return `Pytanie klienta: „${p?.text ?? ''}”${p?.phone ? ` · tel. ${p.phone}` : ''}`;
    }
    case 'accepted':
      return 'Zaakceptowana przez klienta';
    case 'rejected':
      return 'Oznaczona jako odrzucona';
    case 'expired':
      return 'Wygasła';
    default:
      return e.type;
  }
}

function SentView({ offer }: { offer: OfferDetail }) {
  const navigate = useNavigate();
  const mutations = useOfferMutations(offer.id);
  const [copied, setCopied] = useState(false);
  const t = offer.totals;
  const canResend = offer.status !== 'accepted';

  async function copy() {
    await navigator.clipboard?.writeText(offer.link);
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-4 px-5 pb-6 lg:max-w-[720px] lg:px-0">
      <Link
        to="/oferty"
        className="inline-flex min-h-11 items-center gap-1.5 self-start pt-3 text-sm font-medium text-muted"
      >
        <ChevronLeft size={18} aria-hidden /> Oferty
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 font-display text-[30px] leading-tight font-bold tracking-[-0.5px]">
            {offer.title}
          </h1>
          <p className="m-0 text-[15px] text-muted">
            {[
              offer.client?.name,
              offer.number && `oferta nr ${offer.number}`,
              offer.validUntil && `ważna do ${formatDatePl(offer.validUntil)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <StatusPill status={offer.status} />
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/offers/${offer.id}/preview`}
          target="_blank"
          rel="noopener"
          className={buttonClass('dark')}
        >
          Zobacz jak klient
        </a>
        {canResend && (
          <Button variant="secondary" onClick={() => navigate(`/oferty/${offer.id}/wysylka`)}>
            Wyślij ponownie
          </Button>
        )}
        <Button variant="secondary" onClick={() => void copy()}>
          <Copy size={16} aria-hidden /> {copied ? 'Skopiowano' : 'Kopiuj link'}
        </Button>
        <a
          href={`/api/offers/${offer.id}/preview?print=1`}
          target="_blank"
          rel="noopener"
          className={buttonClass('secondary')}
        >
          Pobierz PDF
        </a>
      </div>

      <section className="rounded-card border border-line bg-surface px-5 py-2">
        <ul className="m-0 list-none p-0">
          {offer.items.map((i) => (
            <li
              key={i.key}
              className="flex justify-between gap-3 border-b border-[#EEEAE2] py-2.5 text-[15px] last:border-b-0"
            >
              <span>
                {i.name}
                <span className="block text-[13px] text-muted">
                  {formatQty(i.qtyMilli, i.unit)}
                  {i.unitPriceGr !== null && ` × ${formatPLN(i.unitPriceGr)}`}
                </span>
              </span>
              <span className="font-semibold whitespace-nowrap">
                {i.valueGr === null ? '—' : formatPLN(i.valueGr)}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-1 border-t border-line py-3 text-[15px]">
          <div className="flex justify-between text-ink-2">
            <span>Netto</span>
            <span>{formatPLN(t.netGr)}</span>
          </div>
          <div className="flex justify-between text-ink-2">
            <span>VAT {vatLabel(t.vatBps)}</span>
            <span>{formatPLN(t.vatGr)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Brutto</span>
            <span>{formatPLN(t.grossGr)}</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="m-0 mb-2 text-[13px] font-semibold tracking-[0.8px] text-muted uppercase">Historia</h2>
        <ol className="m-0 flex flex-col gap-1.5 pl-5 text-[15px] text-ink-2">
          {offer.events.map((e, i) => (
            <li
              key={i}
              className={
                e.type === 'accepted'
                  ? 'font-semibold text-success'
                  : e.type === 'question'
                    ? 'text-accent'
                    : ''
              }
            >
              {eventText(e)} <span className="text-[13px] text-muted">· {formatDateTimePl(e.createdAt)}</span>
            </li>
          ))}
        </ol>
      </section>

      {(offer.status === 'sent' || offer.status === 'opened') && (
        <button
          type="button"
          onClick={() =>
            window.confirm('Oznaczyć ofertę jako odrzuconą przez klienta?') && mutations.reject.mutate()
          }
          className="min-h-11 self-start text-[15px] text-muted underline"
        >
          Oznacz jako odrzuconą
        </button>
      )}
      {mutations.reject.error && <Notice tone="error">{errorMessage(mutations.reject.error)}</Notice>}
    </div>
  );
}
