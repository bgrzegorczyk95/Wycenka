import { ChevronLeft, Mic } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { Field, Notice, TextInput } from '../../components/fields';
import { errorMessage } from '../../lib/api';
import { useCreateOffer } from '../../lib/offers';
import { useMe } from '../../lib/session';

/** Screen 2 (Oględziny) – client data. Recording and photos come with M4 (offline queue). */
export function NewOfferPage() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const create = useCreateOffer();
  // One idempotency key per visit: a double tap creates one offer.
  const [clientUuid] = useState(() => crypto.randomUUID());
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mockAi = me?.features.mockAi ?? false;

  async function submit(process: boolean, e?: FormEvent) {
    e?.preventDefault();
    if (name.trim().length < 2) return setNameError('Wpisz imię i nazwisko klienta.');
    setNameError(null);
    setError(null);
    try {
      const offer = await create.mutateAsync({
        input: { clientUuid, client: { name: name.trim(), phone, address } },
        process,
      });
      navigate(`/oferty/${offer.id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-1 flex-col px-5 pb-6 lg:max-w-[560px] lg:px-0">
      <Link
        to="/oferty"
        className="inline-flex min-h-11 items-center gap-1.5 self-start pt-3 text-sm font-medium text-muted"
      >
        <ChevronLeft size={18} aria-hidden /> Oferty
      </Link>
      <h1 className="mt-2 mb-4 font-display text-[28px] font-bold tracking-[-0.5px]">Nowa oferta</h1>

      <form className="flex flex-col gap-3.5" onSubmit={(e) => void submit(mockAi, e)} noValidate>
        <Field label="Klient" htmlFor="client-name" error={nameError ?? undefined}>
          <TextInput
            id="client-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            placeholder="Imię i nazwisko"
            invalid={!!nameError}
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Telefon" htmlFor="client-phone">
            <TextInput
              id="client-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="600 000 000"
            />
          </Field>
          <Field label="Adres" htmlFor="client-address">
            <TextInput
              id="client-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ulica, dzielnica"
            />
          </Field>
        </div>

        <div className="flex items-center gap-3 rounded-card border border-dashed border-[#C9C2B4] p-4 text-sm text-ink-2">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sand">
            <Mic size={20} aria-hidden />
          </span>
          {mockAi
            ? 'Nagrywanie i zdjęcia pojawią się wkrótce. Na razie „Gotowe” przygotuje przykładową ofertę na łazienkę z Twojego cennika.'
            : 'Nagrywanie i zdjęcia pojawią się wkrótce. Na razie uzupełnij pozycje ręcznie.'}
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <div className="mt-2 flex flex-col gap-2.5">
          {mockAi && (
            <>
              <Button type="submit" size="main" disabled={create.isPending}>
                Gotowe – przygotuj ofertę
              </Button>
              <p className="m-0 text-center text-[13px] text-muted">
                AI ułoży pozycje z Twojego cennika. Ceny zawsze sprawdzasz Ty.
              </p>
            </>
          )}
          <Button
            variant={mockAi ? 'secondary' : 'dark'}
            size="main"
            disabled={create.isPending}
            onClick={() => void submit(false)}
          >
            Uzupełnij ręcznie
          </Button>
        </div>
      </form>
    </div>
  );
}
