import { formatPLN, formatQty } from '@wycenka/core/money';
import { PLANS } from '@wycenka/core/plans';
import type { Unit } from '@wycenka/core/schemas';
import { Link } from 'react-router';
import { buttonClass } from '../components/buttonClass';

/** Sample offer from the golden fixture (docs/fixtures/lazienka-kowalska.json). */
const SAMPLE: { name: string; qtyMilli: number; unit: Unit; valueGr: number }[] = [
  { name: 'Skucie płytek', qtyMilli: 30400, unit: 'm2', valueGr: 136800 },
  { name: 'Płytki 60×120 – ściany', qtyMilli: 24400, unit: 'm2', valueGr: 439200 },
  { name: 'Płytki – podłoga', qtyMilli: 6000, unit: 'm2', valueGr: 96000 },
  { name: 'Stelaż podtynkowy WC', qtyMilli: 1000, unit: 'kpl', valueGr: 65000 },
  { name: 'Brodzik walk-in', qtyMilli: 1000, unit: 'kpl', valueGr: 90000 },
];
const SAMPLE_GROSS = 893160;

const STEPS = [
  {
    title: 'Nagraj opis u klienta',
    short: 'Wymiary, zakres prac, czyj materiał. Do tego kilka zdjęć.',
    long: 'Wymiary, zakres prac i czyj materiał. Do tego kilka zdjęć. Działa też bez zasięgu.',
  },
  {
    title: 'Sprawdź pozycje',
    short: 'Ceny bierzemy tylko z Twojego cennika. Ty masz ostatnie słowo.',
    long: 'Ceny bierzemy tylko z Twojego cennika. Czego w nim nie ma, oznaczamy do uzupełnienia.',
  },
  {
    title: 'Wyślij link',
    short: 'Klient akceptuje ofertę jednym kliknięciem, a Ty dostajesz powiadomienie.',
    long: 'Klient akceptuje jednym kliknięciem, a Ty dostajesz powiadomienie i przypomnienie, gdy milczy.',
  },
];

/** 5900 → „59”: plan prices are whole złoty. */
const zl = (gr: number) => String(gr / 100);

const accepted = (
  <span className="rounded-full bg-success-bg px-2.5 py-1 text-xs font-semibold text-success">
    Zaakceptowana
  </span>
);

function SampleOffer() {
  return (
    <div id="przyklad" className="scroll-mt-6 rounded-card border border-line bg-surface p-4 lg:p-6">
      {/* Phone: short card */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold">Łazienka – oferta</span>
          {accepted}
        </div>
        <ul className="m-0 mt-2.5 flex list-none flex-col gap-2 p-0 text-sm text-ink-2">
          {[SAMPLE[1]!, SAMPLE[0]!].map((i) => (
            <li key={i.name} className="flex justify-between gap-3">
              <span>
                {i.name}, {formatQty(i.qtyMilli, i.unit)}
              </span>
              <span>{formatPLN(i.valueGr)}</span>
            </li>
          ))}
          <li className="text-muted">+ 3 pozycje</li>
        </ul>
      </div>
      {/* Desktop: full card */}
      <div className="hidden lg:block">
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold">Remont łazienki</span>
          {accepted}
        </div>
        <p className="m-0 mt-1 text-xs text-muted">Usługi Glazurnicze Nowak · oferta nr 2026/11/014</p>
        <ul className="m-0 mt-3 flex list-none flex-col gap-2 border-t border-line p-0 pt-3 text-sm text-ink-2">
          {SAMPLE.map((i) => (
            <li key={i.name} className="flex justify-between gap-3">
              <span>
                {i.name}
                {i.unit === 'm2' && `, ${formatQty(i.qtyMilli, i.unit)}`}
              </span>
              <span>{formatPLN(i.valueGr)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
        <span className="font-semibold">Brutto</span>
        <span className="text-lg font-bold lg:text-[28px]">{formatPLN(SAMPLE_GROSS)}</span>
      </div>
      <p className="m-0 mt-1 hidden text-xs text-muted lg:block">Z nagrania 0:42 i 3 zdjęć</p>
    </div>
  );
}

export function LandingPage() {
  const cta = '/logowanie';
  return (
    <div className="min-h-dvh">
      <header className="lg:border-b lg:border-line">
        <div className="mx-auto flex max-w-[1160px] items-center justify-between px-5 pt-5 lg:h-20 lg:px-6 lg:pt-0">
          <span className="font-display text-2xl font-bold text-accent">Wycenka</span>
          <nav className="flex items-center gap-2 lg:gap-8">
            <a href="#jak-to-dziala" className="hidden text-[15px] text-ink-2 lg:inline">
              Jak to działa
            </a>
            <a href="#cennik" className="hidden text-[15px] text-ink-2 lg:inline">
              Cennik
            </a>
            <Link
              to="/logowanie"
              className={`${buttonClass('secondary')} lg:border-0 lg:bg-transparent lg:px-0`}
            >
              Zaloguj
            </Link>
            <Link to={cta} className={`${buttonClass('dark')} max-lg:hidden`}>
              Wypróbuj za darmo
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1160px] gap-6 px-5 pt-8 pb-8 lg:grid-cols-[minmax(0,1fr)_410px] lg:items-center lg:gap-16 lg:px-6 lg:py-20">
          <div className="flex flex-col gap-4 lg:gap-6">
            <h1 className="m-0 font-display text-[40px] leading-[46px] font-bold tracking-[-1px] lg:text-[64px] lg:leading-[68px]">
              Oferta dla klienta w 2 minuty. Prosto z oględzin.
            </h1>
            <p className="m-0 text-[17px] leading-[26px] text-ink-2 lg:max-w-[560px] lg:text-lg">
              Nagraj opis i zrób zdjęcia. Wycenka ułoży pozycje z Twojego cennika i wyśle klientowi ofertę z
              przyciskiem „Akceptuję”.
            </p>
            <div className="flex flex-col gap-3 lg:flex-row">
              <Link to={cta} className={buttonClass('accent', 'main') + ' lg:w-auto lg:px-7'}>
                Wypróbuj za darmo
              </Link>
              <a
                href="#przyklad"
                className={`${buttonClass('secondary', 'main')} max-lg:hidden lg:w-auto lg:px-6`}
              >
                Zobacz przykładową ofertę
              </a>
            </div>
            <p className="m-0 text-center text-sm text-muted lg:text-left">
              3 oferty miesięcznie za darmo. Bez karty.
            </p>
          </div>
          <SampleOffer />
        </section>

        <section id="jak-to-dziala" className="scroll-mt-6 lg:border-y lg:border-line lg:bg-surface">
          <div className="mx-auto max-w-[1160px] px-5 py-6 lg:px-6 lg:py-16">
            <h2 className="m-0 mb-5 font-display text-[28px] font-bold lg:mb-10 lg:text-[36px]">
              Jak to działa
            </h2>
            <ol className="m-0 grid list-none gap-5 p-0 lg:grid-cols-3 lg:gap-10">
              {STEPS.map((s, n) => (
                <li key={s.title} className="flex gap-4 lg:flex-col lg:gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
                    {n + 1}
                  </span>
                  <div>
                    <p className="m-0 text-[17px] font-semibold">{s.title}</p>
                    <p className="m-0 mt-1 text-[15px] leading-[22px] text-ink-2">
                      <span className="lg:hidden">{s.short}</span>
                      <span className="hidden lg:inline">{s.long}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="cennik" className="mx-auto max-w-[1160px] scroll-mt-6 px-5 py-6 lg:px-6 lg:py-16">
          <h2 className="m-0 mb-5 font-display text-[28px] font-bold lg:mb-10 lg:text-[36px]">
            Ile to kosztuje
          </h2>
          {/* Phone: compact rows */}
          <div className="flex flex-col gap-3 lg:hidden">
            <div className="flex items-center justify-between rounded-card border border-line bg-surface p-4">
              <div>
                <p className="m-0 text-[17px] font-semibold">{PLANS.free.label}</p>
                <p className="m-0 text-sm text-muted">3 oferty miesięcznie</p>
              </div>
              <span className="text-lg font-bold">0 zł</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-card border-2 border-accent bg-surface p-4">
              <div>
                <p className="m-0 text-[17px] font-semibold">{PLANS.pro.label}</p>
                <p className="m-0 text-sm text-muted">bez limitu, Twoje logo, przypomnienia</p>
              </div>
              <span className="text-lg font-bold whitespace-nowrap">
                {zl(PLANS.pro.monthlyNetGr!)} zł{' '}
                <span className="text-sm font-normal text-muted">/mies.</span>
              </span>
            </div>
          </div>
          {/* Desktop: three cards */}
          <div className="hidden gap-5 lg:grid lg:grid-cols-3">
            {[
              {
                plan: PLANS.free,
                price: '0 zł',
                suffix: '',
                items: ['3 oferty miesięcznie', 'Akceptacja online', 'Stopka „zrobione w Wycence”'],
              },
              {
                plan: PLANS.pro,
                price: `${zl(PLANS.pro.monthlyNetGr!)} zł`,
                suffix: 'netto / mies.',
                items: ['Oferty bez limitu', 'Twoje logo, bez stopki', 'Przypomnienia o kontakcie'],
                highlight: true,
              },
              {
                plan: PLANS.team,
                price: `od ${zl(PLANS.team.monthlyNetGr!)} zł`,
                suffix: 'netto / mies.',
                items: [
                  'Kilka osób na jednym koncie',
                  'Wspólny cennik',
                  'Oferty całej ekipy w jednym miejscu',
                ],
              },
            ].map((p) => (
              <div
                key={p.plan.id}
                className={`flex flex-col gap-3 rounded-card bg-surface p-6 ${p.highlight ? 'border-2 border-accent' : 'border border-line'}`}
              >
                <p className="m-0 text-[17px] font-semibold">{p.plan.label}</p>
                <p className="m-0 text-[36px] font-bold">
                  {p.price} {p.suffix && <span className="text-sm font-normal text-muted">{p.suffix}</span>}
                </p>
                <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[15px] text-ink-2">
                  {p.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
                {p.highlight && (
                  <Link to={cta} className={buttonClass('accent') + ' mt-auto w-full'}>
                    Zacznij za darmo
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="px-5 pt-4 pb-4 lg:hidden">
          <Link to={cta} className={buttonClass('dark', 'main')}>
            Załóż konto
          </Link>
        </div>
      </main>

      <footer className="lg:border-t lg:border-line">
        <div className="mx-auto flex max-w-[1160px] items-center justify-center px-5 pb-6 text-[13px] text-muted lg:h-16 lg:justify-between lg:px-6 lg:pb-0">
          <span className="hidden lg:inline">Wycenka</span>
          <span>
            <span className="lg:hidden">Ceny netto. </span>
            <Link to="/regulamin">Regulamin</Link> ·{' '}
            <Link to="/polityka-prywatnosci">Polityka prywatności</Link>
            <span className="hidden lg:inline">
              {' · '}
              <a href="mailto:kontakt@wycenka.pl">Kontakt</a>
            </span>
          </span>
        </div>
      </footer>
    </div>
  );
}
