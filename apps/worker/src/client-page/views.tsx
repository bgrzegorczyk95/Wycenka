import {
  formatDatePl,
  formatDateTimePl,
  formatDayMonthPl,
  formatPLN,
  formatPercent,
  formatQty,
  vatLabel,
  type OfferStatus,
  type PriceOfferResult,
} from '@wycenka/core';
import type { FC, PropsWithChildren } from 'hono/jsx';
import { raw } from 'hono/html';
import { CLIENT_CSS } from './styles';

export interface ClientOfferView {
  token: string;
  number: string | null;
  title: string;
  status: OfferStatus;
  createdAt: number;
  acceptedAt: number | null;
  validUntil: string | null;
  depositBps: number | null;
  startText: string | null;
  notesForClient: string | null;
  material: 'client' | 'contractor';
  company: {
    name: string;
    phone: string | null;
    serviceArea: string | null;
    initials: string;
    logoUrl: string | null;
  };
  showFooter: boolean;
  result: PriceOfferResult;
}

export type PageMode = 'client' | 'preview' | 'print';

interface LayoutProps {
  title: string;
  description: string;
  nonce: string;
  mode: PageMode;
  beaconUrl?: string | undefined;
}

export const Layout: FC<PropsWithChildren<LayoutProps>> = ({
  title,
  description,
  nonce,
  mode,
  beaconUrl,
  children,
}) => (
  <html lang="pl">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex, nofollow" />
      <title>{title}</title>
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <style nonce={nonce}>{raw(CLIENT_CSS)}</style>
    </head>
    <body>
      {mode === 'preview' && <div class="preview">Podgląd – klient zobaczy ofertę dopiero po wysłaniu.</div>}
      {children}
      {beaconUrl && (
        // Opening is recorded by a beacon after load – link preview bots only fetch the HTML.
        <script nonce={nonce}>
          {raw(`navigator.sendBeacon&&navigator.sendBeacon(${JSON.stringify(beaconUrl)});`)}
        </script>
      )}
      {mode === 'print' && (
        <script nonce={nonce}>{raw('window.addEventListener("load",function(){window.print()});')}</script>
      )}
    </body>
  </html>
);

const Header: FC<{ v: ClientOfferView; subtitle: string }> = ({ v, subtitle }) => (
  <header class="top">
    <div class="top-inner">
      <div class="badge">
        {v.company.logoUrl ? <img src={v.company.logoUrl} alt="" /> : v.company.initials}
      </div>
      <div>
        <p class="company">{v.company.name}</p>
        <p class="meta">{subtitle}</p>
      </div>
    </div>
  </header>
);

const Footer: FC<{ show: boolean }> = ({ show }) =>
  show ? <footer class="footer">Oferta przygotowana w aplikacji Wycenka</footer> : null;

function numberLine(v: ClientOfferView): string {
  const parts = [v.number ? `Oferta nr ${v.number}` : 'Oferta'];
  if (v.validUntil) parts.push(`ważna do ${formatDatePl(v.validUntil)}`);
  return parts.join(' · ');
}

const qtyLine = (item: PriceOfferResult['items'][number]) =>
  item.unitPriceGr === null
    ? formatQty(item.qtyMilli, item.unit)
    : `${formatQty(item.qtyMilli, item.unit)} × ${formatPLN(item.unitPriceGr)}`;

function depositText(bps: number | null): string {
  return bps ? `${formatPercent(bps)} przy rozpoczęciu` : 'bez zaliczki';
}

const Terms: FC<{ v: ClientOfferView }> = ({ v }) => (
  <>
    <h2 class="section-title">Warunki</h2>
    <dl class="terms">
      <dt>Materiał</dt>
      <dd>{v.material === 'client' ? 'po stronie klienta' : 'po stronie wykonawcy'}</dd>
      <dt>Zaliczka</dt>
      <dd>{depositText(v.depositBps)}</dd>
      {v.startText && (
        <>
          <dt>Rozpoczęcie</dt>
          <dd>{v.startText}</dd>
        </>
      )}
      {v.notesForClient && (
        <>
          <dt>Uwagi</dt>
          <dd>{v.notesForClient}</dd>
        </>
      )}
    </dl>
  </>
);

const Totals: FC<{ r: PriceOfferResult }> = ({ r }) => (
  <div class="totals">
    {r.discountGr > 0 && (
      <div class="row">
        <span>Rabat</span>
        <span>−{formatPLN(r.discountGr)}</span>
      </div>
    )}
    <div class="row">
      <span>Netto</span>
      <span>{formatPLN(r.netGr)}</span>
    </div>
    <div class="row">
      <span>VAT {vatLabel(r.vatBps)}</span>
      <span>{formatPLN(r.vatGr)}</span>
    </div>
    <div class="gross">
      <span>Do zapłaty brutto</span>
      <strong>{formatPLN(r.grossGr)}</strong>
    </div>
  </div>
);

interface OfferPageProps {
  v: ClientOfferView;
  mode: PageMode;
  confirm: boolean;
  notice?: string | undefined;
  expired: boolean;
}

/** Screens 4 and 11: the offer (also the preview for the contractor and the print/PDF version). */
export const OfferPage: FC<OfferPageProps> = ({ v, mode, confirm, notice, expired }) => {
  const base = `/o/${v.token}`;
  const interactive = mode === 'client' && !expired;
  const tel = v.company.phone ? `tel:${v.company.phone}` : null;
  return (
    <>
      <Header v={v} subtitle={numberLine(v)} />
      <main class="wrap">
        <div>
          <h1>{v.title}</h1>
          <p class="lead">
            Dzień dobry, poniżej zakres prac i cena po oględzinach z {formatDayMonthPl(v.createdAt)}.
          </p>
          {notice && <p class="notice">{notice}</p>}
          {expired && (
            <p class="notice warn">
              Ta oferta jest już nieaktualna. Zadzwoń do wykonawcy, żeby ustalić szczegóły.
            </p>
          )}

          <h2 class="section-title">Zakres prac</h2>
          <ul class="items">
            {v.result.items.map((item) => (
              <li>
                <span>
                  <span class="name">{item.name}</span>
                  <span class="qty">{qtyLine(item)}</span>
                </span>
                <span class="value">{item.valueGr === null ? '—' : formatPLN(item.valueGr)}</span>
              </li>
            ))}
          </ul>
          <table class="items-table">
            <thead>
              <tr>
                <th>Pozycja</th>
                <th class="num">Ilość</th>
                <th class="num">Cena</th>
                <th class="num">Wartość</th>
              </tr>
            </thead>
            <tbody>
              {v.result.items.map((item) => (
                <tr>
                  <td>{item.name}</td>
                  <td class="num">{formatQty(item.qtyMilli, item.unit)}</td>
                  <td class="num">{item.unitPriceGr === null ? '—' : formatPLN(item.unitPriceGr)}</td>
                  <td class="num">{item.valueGr === null ? '—' : formatPLN(item.valueGr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Terms v={v} />
        </div>

        <aside class="side">
          <Totals r={v.result} />
          {interactive && !confirm && (
            <div class="actions">
              <a class="btn btn-accept" href={`${base}?potwierdz=1#akceptacja`}>
                Akceptuję ofertę
              </a>
              <div class="btn-row">
                <a class="btn" href={`${base}/pytanie`}>
                  Mam pytanie
                </a>
                {tel ? (
                  <a class="btn" href={tel}>
                    Zadzwoń
                  </a>
                ) : (
                  <a class="btn" href={`${base}/pdf`}>
                    Pobierz PDF
                  </a>
                )}
              </div>
              {tel && (
                <a class="btn" href={`${base}/pdf`}>
                  Pobierz PDF
                </a>
              )}
            </div>
          )}
          {interactive && confirm && (
            <form class="confirm" id="akceptacja" method="post" action={`${base}/accept`}>
              <p>Akceptujesz ofertę na {formatPLN(v.result.grossGr)}?</p>
              <button class="btn btn-accept" type="submit">
                Tak, akceptuję
              </button>
              <a class="back" href={base}>
                Wróć do oferty
              </a>
            </form>
          )}
          {expired && tel && (
            <div class="actions">
              <a class="btn" href={tel}>
                Zadzwoń
              </a>
            </div>
          )}
          {interactive && (
            <p class="hint">
              Po akceptacji wykonawca dostanie powiadomienie, a data i godzina zostaną zapisane w ofercie.
            </p>
          )}
        </aside>
      </main>
      <Footer show={v.showFooter} />
    </>
  );
};

/** Screen 20: after acceptance. */
export const AcceptedPage: FC<{ v: ClientOfferView }> = ({ v }) => {
  const base = `/o/${v.token}`;
  return (
    <>
      <Header v={v} subtitle={v.number ? `Oferta nr ${v.number}` : 'Oferta'} />
      <main class="wrap single">
        <div class="done-icon" aria-hidden="true">
          ✓
        </div>
        <h1>Dziękujemy, oferta zaakceptowana</h1>
        <p class="lead">Wykonawca dostał już informację i zadzwoni, żeby ustalić termin rozpoczęcia prac.</p>
        <div class="card">
          <div class="row">
            <strong>{v.title}</strong>
            <strong>{formatPLN(v.result.grossGr)}</strong>
          </div>
          {v.acceptedAt && (
            <div class="row">
              <span>Zaakceptowano</span>
              <span>{formatDateTimePl(v.acceptedAt)}</span>
            </div>
          )}
          <div class="row">
            <span>Zaliczka</span>
            <span>{depositText(v.depositBps)}</span>
          </div>
        </div>
        <div class="actions">
          <a class="btn" href={`${base}/pdf`}>
            Pobierz PDF
          </a>
          {v.company.phone && (
            <a class="btn" href={`tel:${v.company.phone}`}>
              Zadzwoń
            </a>
          )}
        </div>
      </main>
      <Footer show={v.showFooter} />
    </>
  );
};

const PRESET_QUESTIONS = ['Kiedy możecie zacząć?', 'Ile potrwają prace?', 'Czy można zmienić zakres?'];

/** Screen 21: „Mam pytanie”. Works without JS (chips reload the form with the text). */
export const QuestionPage: FC<{
  v: ClientOfferView;
  text: string;
  phone: string;
  error?: string | undefined;
}> = ({ v, text, phone, error }) => {
  const base = `/o/${v.token}`;
  return (
    <>
      <Header v={v} subtitle={v.number ? `Oferta nr ${v.number}` : 'Oferta'} />
      <main class="wrap single">
        <a class="back" href={base}>
          ‹ Wróć do oferty
        </a>
        <h1>Zadaj pytanie</h1>
        <p class="lead">{v.company.name} dostaną je od razu, razem z numerem oferty.</p>
        <form method="get" action={`${base}/pytanie`}>
          <p class="section-title">Częste pytania</p>
          <div class="chips">
            {PRESET_QUESTIONS.map((q) => (
              <button class="chip" type="submit" name="q" value={q}>
                {q}
              </button>
            ))}
          </div>
        </form>
        <form method="post" action={`${base}/pytanie`}>
          <label for="text">Twoje pytanie</label>
          <textarea id="text" name="text" maxlength={1000} required>
            {text}
          </textarea>
          <label for="phone">Telefon do kontaktu (opcjonalnie)</label>
          <input id="phone" name="phone" type="tel" autocomplete="tel" value={phone} />
          <div class="hp" aria-hidden="true">
            <label for="website">Strona www</label>
            <input id="website" name="website" tabindex={-1} autocomplete="off" />
          </div>
          {error && <p class="error">{error}</p>}
          <div class="actions">
            <button class="btn btn-dark" type="submit">
              Wyślij pytanie
            </button>
          </div>
          <p class="hint">Oferta pozostaje aktywna – możesz ją zaakceptować później.</p>
        </form>
      </main>
      <Footer show={v.showFooter} />
    </>
  );
};

export const NotFoundPage: FC = () => (
  <main class="wrap single">
    <h1>Nie znaleziono oferty</h1>
    <p class="lead">Link jest nieprawidłowy albo oferta została wycofana. Skontaktuj się z wykonawcą.</p>
  </main>
);
