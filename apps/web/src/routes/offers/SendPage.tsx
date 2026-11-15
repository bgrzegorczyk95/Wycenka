import {
  DEPOSIT_BPS,
  formatDatePl,
  formatPLN,
  formatPercent,
  isSentStatus,
  offerMessage,
  sendDeepLink,
  type OfferDetail,
  type SendChannel,
} from '@wycenka/core';
import { ChevronLeft, FileText } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { Button } from '../../components/Button';
import { CompanyBadge } from '../../components/CompanyForm';
import { Field, Group, Notice, Select, TextInput } from '../../components/fields';
import { FullPageMessage } from '../../components/guards';
import { errorMessage } from '../../lib/api';
import { logoUrl } from '../../lib/image';
import { useOffer, useOfferMutations } from '../../lib/offers';
import { pluralPl, DESKTOP_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { useMe } from '../../lib/session';

const CHANNELS: { value: Exclude<SendChannel, 'link'>; label: string }[] = [
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'E-mail' },
];
const CHANNEL_STORAGE = 'wycenka.sendChannel';

function rememberedChannel(): Exclude<SendChannel, 'link'> {
  try {
    const v = localStorage.getItem(CHANNEL_STORAGE);
    return v === 'whatsapp' || v === 'email' ? v : 'sms';
  } catch {
    return 'sms';
  }
}

export function SendPage() {
  const { id = '' } = useParams();
  const { data: offer, isPending, isError } = useOffer(id);
  if (isPending) return <FullPageMessage>Wczytywanie…</FullPageMessage>;
  if (isError) return <FullPageMessage>Nie udało się wczytać oferty.</FullPageMessage>;
  if (offer.status === 'accepted' || offer.status === 'processing')
    return <Navigate to={`/oferty/${id}`} replace />;
  return <SendForm offer={offer} />;
}

function SendForm({ offer }: { offer: OfferDetail }) {
  const { data: me } = useMe();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const navigate = useNavigate();
  const mutations = useOfferMutations(offer.id);
  const [channel, setChannel] = useState(rememberedChannel);
  const [message, setMessage] = useState(() => offerMessage(offer.title, offer.link, me?.user.name ?? ''));
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = isSentStatus(offer.status);
  const preview = `/api/offers/${offer.id}/preview`;

  const patch = (body: Parameters<typeof mutations.patch.mutate>[0]) =>
    mutations.patch.mutate(body, { onError: (e) => setError(errorMessage(e)) });

  function pickChannel(c: Exclude<SendChannel, 'link'>) {
    setChannel(c);
    try {
      localStorage.setItem(CHANNEL_STORAGE, c);
    } catch {
      /* private mode – not remembered */
    }
  }

  /**
   * The app (SMS / WhatsApp / e-mail / share sheet) must open inside the tap: iOS Safari blocks popups,
   * share and clipboard after an await. The link is known before sending, so we open first and record
   * the „sent” status in parallel (keepalive survives leaving the page for the SMS app).
   */
  async function send() {
    setError(null);
    const to = { phone: offer.client?.phone ?? null, email: offer.client?.email ?? null };
    const deepLink = sendDeepLink(channel, message, to, `Oferta: ${offer.title}`);
    let opened: Promise<unknown> = Promise.resolve();
    let copied = false;
    // The message goes from the contractor's own phone apps (docs/01 „Czego NIE robimy”).
    if (deepLink) {
      if (channel === 'whatsapp') window.open(deepLink, '_blank', 'noopener');
      else window.location.href = deepLink;
    } else if (navigator.share) {
      opened = navigator
        .share({ title: `Oferta: ${offer.title}`, text: message, url: offer.link })
        .catch(() => undefined);
    } else {
      opened = navigator.clipboard?.writeText(message) ?? Promise.resolve();
      copied = true;
    }
    try {
      await Promise.all([mutations.send.mutateAsync(channel), opened]);
      if (copied) {
        setNotice('Brak numeru klienta – skopiowaliśmy wiadomość z linkiem. Wklej ją klientowi.');
        return;
      }
      navigate(`/oferty/${offer.id}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function copyLink() {
    setError(null);
    // Clipboard first, inside the tap (see send()).
    const copied = navigator.clipboard?.writeText(offer.link) ?? Promise.resolve();
    try {
      await Promise.all([mutations.send.mutateAsync('link'), copied]);
      setNotice('Link skopiowany. Wklej go klientowi.');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const n = offer.items.length;
  const summary = `${n} ${pluralPl(n, 'pozycja', 'pozycje', 'pozycji')} · brutto ${formatPLN(offer.totals.grossGr)}`;

  const thumbnail = me && (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <CompanyBadge name={me.company.name} logo={logoUrl(me)} />
        <div className="min-w-0">
          <p className="m-0 text-[15px] font-semibold">{me.company.name}</p>
          <p className="m-0 text-[13px] text-muted">
            {offer.number ? `Oferta nr ${offer.number}` : 'Numer nadamy przy wysyłce'}
          </p>
        </div>
      </div>
      <div>
        <p className="m-0 font-display text-[22px] font-bold">{offer.title}</p>
        <p className="m-0 text-[15px] text-ink-2">{summary}</p>
      </div>
      <a
        href={`${preview}?print=1`}
        target="_blank"
        rel="noopener"
        className="flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold text-accent"
      >
        <FileText size={18} aria-hidden /> Otwórz PDF
      </a>
    </section>
  );

  const form = (
    <div className="flex flex-col gap-3.5">
      <Group legend="Warunki" className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Ważna do" htmlFor="valid-until">
            <TextInput
              id="valid-until"
              type="date"
              disabled={locked}
              defaultValue={offer.validUntil ?? ''}
              onBlur={(e) =>
                e.target.value !== (offer.validUntil ?? '') && patch({ validUntil: e.target.value || null })
              }
            />
          </Field>
          <Field label="Zaliczka" htmlFor="deposit">
            <Select
              id="deposit"
              disabled={locked}
              value={offer.depositBps ?? 0}
              onChange={(e) => patch({ depositBps: Number(e.target.value) })}
            >
              {DEPOSIT_BPS.map((b) => (
                <option key={b} value={b}>
                  {b === 0 ? 'brak' : formatPercent(b)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Rozpoczęcie" htmlFor="start">
          <TextInput
            id="start"
            disabled={locked}
            defaultValue={offer.startText ?? ''}
            placeholder="np. od 2 grudnia 2026"
            onBlur={(e) => e.target.value !== (offer.startText ?? '') && patch({ startText: e.target.value })}
          />
        </Field>
        <Field label="Uwagi dla klienta (opcjonalnie)" htmlFor="notes">
          <textarea
            id="notes"
            disabled={locked}
            defaultValue={offer.notesForClient ?? ''}
            rows={2}
            onBlur={(e) =>
              e.target.value !== (offer.notesForClient ?? '') && patch({ notesForClient: e.target.value })
            }
            className="w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2.5 text-[15px] focus:border-ink focus:outline-none disabled:opacity-60"
          />
        </Field>
      </Group>

      <p className="m-0 mt-1 text-[15px] font-semibold text-ink-2">Wyślij przez</p>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Kanał wysyłki">
        {CHANNELS.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={channel === c.value}
            onClick={() => pickChannel(c.value)}
            className={`min-h-12 rounded-field text-[15px] font-semibold ${
              channel === c.value
                ? 'border-2 border-accent bg-accent-tint text-ink'
                : 'border border-line-strong bg-surface text-ink-2'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <Field label={offer.client ? `Do: ${offer.client.name}` : 'Wiadomość'} htmlFor="message">
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="w-full rounded-[10px] border border-line-strong bg-sand px-3 py-2.5 text-[15px] leading-[22px] focus:border-ink focus:outline-none"
        />
      </Field>
      {offer.validUntil && (
        <p className="m-0 text-[13px] text-muted">
          Klient zobaczy ofertę ważną do {formatDatePl(offer.validUntil)}.
        </p>
      )}

      {notice && <Notice tone="success">{notice}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <Button
        size="main"
        disabled={mutations.send.isPending || !offer.totals.canSend}
        onClick={() => void send()}
      >
        {locked ? 'Wyślij ponownie' : 'Wyślij ofertę'}
      </Button>
      <div className={desktop ? 'grid grid-cols-2 gap-2' : ''}>
        {desktop && (
          <a
            href={`${preview}?print=1`}
            target="_blank"
            rel="noopener"
            className="flex min-h-12 items-center justify-center rounded-field border border-line-strong bg-surface text-[15px] font-semibold"
          >
            Pobierz PDF
          </a>
        )}
        <Button
          variant="secondary"
          className="min-h-12 w-full"
          disabled={mutations.send.isPending}
          onClick={() => void copyLink()}
        >
          Kopiuj link
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 px-5 pb-6 lg:px-0">
      <Link
        to={`/oferty/${offer.id}`}
        className="inline-flex min-h-11 items-center gap-1.5 self-start pt-3 text-sm font-medium text-muted"
      >
        <ChevronLeft size={18} aria-hidden /> {locked ? 'Oferta' : 'Pozycje'}
      </Link>
      <h1 className="m-0 mb-1 font-display text-[28px] font-bold tracking-[-0.5px] lg:text-[34px]">
        Podgląd i wysyłka
      </h1>
      {desktop ? (
        <div className="grid grid-cols-[minmax(0,1fr)_400px] items-start gap-6">
          <iframe
            title="Podgląd oferty"
            src={preview}
            className="h-[calc(100dvh-160px)] min-h-[600px] w-full rounded-card border border-line bg-surface"
          />
          {form}
        </div>
      ) : (
        <>
          {thumbnail}
          {form}
        </>
      )}
    </div>
  );
}
