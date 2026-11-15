import { normalizePlPhone } from '@wycenka/core/phone';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { Notice, TextInput } from '../components/fields';
import { labelClass } from '../components/fieldClasses';
import { errorMessage } from '../lib/api';
import { sendEmailCode, sendPhoneCode, verifyEmailCode, verifyPhoneCode } from '../lib/auth';
import { fetchMe, homePath, ME_KEY, useMe } from '../lib/session';

const RESEND_SECONDS = 60;
type Mode = 'phone' | 'email';

function useCountdown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, start: () => setLeft(RESEND_SECONDS) };
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeStep, setCodeStep] = useState(false);
  const [sentNotice, setSentNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const countdown = useCountdown();
  const contactRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  useMe(); // warm the session query

  const e164 = normalizePlPhone(phone);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  function contactError(): string | null {
    if (mode === 'phone') return e164 ? null : 'Wpisz 9 cyfr numeru telefonu.';
    return emailValid ? null : 'Wpisz poprawny adres e-mail.';
  }

  async function sendCode() {
    const invalid = contactError();
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    try {
      if (mode === 'phone') await sendPhoneCode(e164!);
      else await sendEmailCode(email.trim());
      setCodeStep(true);
      setSentNotice(true);
      setCode('');
      countdown.start();
      setTimeout(() => codeRef.current?.focus(), 0);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify(value = code) {
    if (!/^\d{6}$/.test(value)) return setError('Kod ma 6 cyfr.');
    const invalid = contactError();
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    try {
      if (mode === 'phone') await verifyPhoneCode(e164!, value);
      else await verifyEmailCode(email.trim(), value);
      const me = await queryClient.fetchQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: 0 });
      navigate(me ? homePath(me) : '/oferty', { replace: true });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    void (codeStep ? verify() : sendCode());
  }

  function switchMode(next: Mode) {
    setMode(next);
    setCodeStep(false);
    setSentNotice(false);
    setCode('');
    setError(null);
    setTimeout(() => contactRef.current?.focus(), 0);
  }

  const form = (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact" className={labelClass}>
          {mode === 'phone' ? 'Numer telefonu' : 'Adres e-mail'}
        </label>
        <div className="flex gap-2">
          {mode === 'phone' && (
            <span className="flex min-h-[52px] items-center rounded-field border border-line-strong bg-sand px-3 text-base text-ink-2">
              +48
            </span>
          )}
          <TextInput
            ref={contactRef}
            id="contact"
            large
            value={mode === 'phone' ? phone : email}
            onChange={(e) => (mode === 'phone' ? setPhone(e.target.value) : setEmail(e.target.value))}
            type={mode === 'phone' ? 'tel' : 'email'}
            inputMode={mode === 'phone' ? 'tel' : 'email'}
            autoComplete={mode === 'phone' ? 'tel-national' : 'email'}
            placeholder={mode === 'phone' ? '600 000 000' : 'imie@firma.pl'}
          />
        </div>
      </div>

      {sentNotice && !error && (
        <Notice tone="success">
          {mode === 'phone' ? 'Kod wysłany. Wpisz go poniżej.' : 'Kod wysłany na e-mail. Wpisz go poniżej.'}
        </Notice>
      )}

      {codeStep && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="code" className={labelClass}>
            {mode === 'phone' ? 'Kod z SMS-a' : 'Kod z e-maila'}
          </label>
          <input
            ref={codeRef}
            id="code"
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 6);
              setCode(v);
              if (v.length === 6 && !busy) void verify(v);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6 cyfr"
            maxLength={6}
            className="min-h-14 w-full rounded-field border-2 border-ink bg-surface px-3.5 text-[22px] font-semibold tracking-[8px] text-ink placeholder:font-normal placeholder:tracking-[4px] placeholder:text-muted/70 focus:outline-none"
          />
          {countdown.left > 0 ? (
            <span className="flex min-h-11 items-center text-sm text-muted">
              Wyślij ponownie za {mmss(countdown.left)}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void sendCode()}
              disabled={busy}
              className="min-h-11 self-start text-sm font-semibold text-ink underline"
            >
              Wyślij kod ponownie
            </button>
          )}
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      <Button type="submit" size="main" disabled={busy}>
        {codeStep ? 'Zaloguj' : 'Wyślij kod'}
      </Button>

      {!codeStep && (
        <button
          type="button"
          onClick={() => {
            const invalid = contactError();
            if (invalid) return setError(invalid);
            setError(null);
            setCodeStep(true);
            setTimeout(() => codeRef.current?.focus(), 0);
          }}
          className="min-h-11 text-[13px] text-muted underline"
        >
          Mam już kod – przejdź dalej
        </button>
      )}

      <div className="flex items-center gap-3 text-[13px] text-muted">
        <div className="h-px flex-1 bg-[#DDD7CC]" />
        lub
        <div className="h-px flex-1 bg-[#DDD7CC]" />
      </div>
      <Button
        variant="secondary"
        className="min-h-[52px] w-full rounded-button text-[15px]"
        onClick={() => switchMode(mode === 'phone' ? 'email' : 'phone')}
      >
        {mode === 'phone' ? 'Zaloguj adresem e-mail' : 'Zaloguj numerem telefonu'}
      </Button>
    </form>
  );

  const footer = (
    <div className="flex flex-col items-center gap-2 pt-6">
      <button
        type="button"
        onClick={() => switchMode('phone')}
        className="min-h-11 text-[15px] font-semibold text-ink underline"
      >
        Nie masz konta? Załóż je w 2 minuty
      </button>
      <p className="m-0 text-center text-xs leading-[17px] text-muted">
        Logując się, akceptujesz{' '}
        <Link to="/regulamin" className="underline">
          regulamin
        </Link>{' '}
        i{' '}
        <Link to="/polityka-prywatnosci" className="underline">
          politykę prywatności
        </Link>
        .
      </p>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,700px)_1fr]">
      {/* Desktop: benefits on a dark panel */}
      <aside className="hidden bg-ink px-16 py-16 text-white lg:block">
        <Link to="/" className="font-display text-2xl font-bold">
          Wycenka
        </Link>
        <h2 className="mt-8 mb-6 max-w-[440px] font-display text-[42px] leading-[48px] font-bold tracking-[-0.5px]">
          Twoje oferty i cennik w jednym miejscu.
        </h2>
        <ul className="m-0 flex max-w-[440px] list-none flex-col gap-3.5 p-0 text-base text-white/85">
          {[
            'Na telefonie nagrywasz oględziny, tutaj spokojnie poprawiasz oferty.',
            'Cennik edytujesz w tabeli, jak w Excelu.',
            'Widzisz, kto otworzył ofertę, a kto ją zaakceptował.',
          ].map((t) => (
            <li key={t} className="flex gap-3">
              <Check size={18} className="mt-0.5 shrink-0 text-[#F2A57E]" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </aside>

      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pt-4 pb-6 lg:justify-center lg:px-0 lg:py-16 lg:max-w-[420px]">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-muted lg:hidden"
        >
          <ChevronLeft size={18} aria-hidden /> Wróć
        </Link>
        <span className="mt-4 font-display text-[22px] font-bold text-accent lg:hidden">Wycenka</span>
        <h1 className="mt-1 mb-2 font-display text-[30px] font-bold tracking-[-0.5px]">Zaloguj się</h1>
        <p className="m-0 mb-6 text-[15px] leading-[22px] text-ink-2">
          {mode === 'phone'
            ? 'Wyślemy kod SMS. Bez hasła do zapamiętania.'
            : 'Wyślemy kod e-mailem. Bez hasła do zapamiętania.'}
        </p>
        {form}
        <div className="flex-1 lg:hidden" />
        <div className="lg:mt-4 lg:border-t lg:border-line">{footer}</div>
      </main>
    </div>
  );
}
