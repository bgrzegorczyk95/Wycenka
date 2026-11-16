import { formatPLN, type OfferListItem } from '@wycenka/core';
import { Mic, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { FullPageMessage } from '../components/guards';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { isDraftStatus, useOffers } from '../lib/offers';
import { useMe } from '../lib/session';
import { useWaitingOffers } from '../offline/autoSync';

function OfferCard({ offer }: { offer: OfferListItem }) {
  const draft = isDraftStatus(offer.status);
  const subtitle = [offer.clientName, offer.clientAddress].filter(Boolean).join(' · ');
  return (
    <li>
      <Link
        to={`/oferty/${offer.id}`}
        className={`flex flex-col gap-1.5 rounded-[14px] px-4 py-3.5 ${
          draft ? 'border border-dashed border-[#C9C2B4]' : 'border border-line bg-surface'
        } hover:border-ink-2`}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[17px] font-semibold">{offer.title}</span>
          <span className="text-[17px] font-semibold whitespace-nowrap">
            {offer.grossGr === null ? '—' : formatPLN(offer.grossGr)}
          </span>
        </span>
        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-[15px] text-muted">{subtitle}</span>
          <StatusPill status={offer.status} />
        </span>
      </Link>
    </li>
  );
}

export function OffersPage() {
  const { data: me } = useMe();
  const { data: offers, isPending, isError, refetch } = useOffers();
  const waiting = useWaitingOffers() ?? [];
  const navigate = useNavigate();
  const newOffer = () => navigate('/oferty/nowa');

  return (
    <>
      <PageHeader
        eyebrow={me?.company.name}
        title="Oferty"
        actions={
          <div className="hidden lg:block">
            <Button variant="accent" onClick={newOffer}>
              <Plus size={18} aria-hidden /> Nowa oferta
            </Button>
          </div>
        }
      />
      <div className="flex flex-1 flex-col px-5 lg:px-0">
        {waiting.length > 0 && (
          <Link
            to="/oferty/oczekujace"
            className="mb-4 flex items-center justify-between gap-3 rounded-[14px] border border-warn-line bg-warn-bg px-4 py-3.5 lg:max-w-[720px]"
          >
            <span>
              <span className="block text-[17px] font-semibold">
                {waiting.length === 1
                  ? waiting[0]!.client.name || 'Oględziny'
                  : `${waiting.length} oględziny`}
              </span>
              <span className="block text-[15px] text-warn">Czeka w telefonie na wysłanie</span>
            </span>
            <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-warn">Czeka</span>
          </Link>
        )}
        {isPending ? (
          <FullPageMessage>Wczytywanie ofert…</FullPageMessage>
        ) : isError ? (
          <button
            type="button"
            className="min-h-11 text-[15px] text-muted underline"
            onClick={() => void refetch()}
          >
            Nie udało się wczytać ofert. Spróbuj ponownie
          </button>
        ) : offers.length === 0 && waiting.length === 0 ? (
          <section className="flex flex-col items-center gap-4 rounded-card border border-line bg-surface px-6 py-10 text-center">
            <p className="m-0 max-w-[320px] text-[15px] leading-[22px] text-ink-2">
              Nie masz jeszcze żadnej oferty. AI ułoży pozycje z Twojego cennika. Ceny zawsze sprawdzasz Ty.
            </p>
            <Button variant="dark" onClick={newOffer}>
              Zrób pierwszą ofertę
            </Button>
          </section>
        ) : (
          <>
            <h2 className="m-0 mb-2.5 text-[13px] font-semibold tracking-[0.8px] text-muted uppercase">
              Ostatnie oferty
            </h2>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:max-w-[720px]">
              {offers.map((o) => (
                <OfferCard key={o.id} offer={o} />
              ))}
            </ul>
          </>
        )}
      </div>
      <div className="sticky bottom-[76px] mt-auto px-5 pt-4 pb-4 lg:hidden">
        <Button size="main" onClick={newOffer}>
          <Mic size={22} aria-hidden /> Nowa oferta
        </Button>
      </div>
    </>
  );
}
