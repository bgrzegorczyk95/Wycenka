# 03. Architektura

## Decyzje

| Obszar | Wybór | Dlaczego |
|---|---|---|
| Aplikacja fachowca | PWA: React + TS + Vite, `vite-plugin-pwa` | Jeden kod na telefon i komputer, instalacja z przeglądarki, brak prowizji sklepów. Później opakowanie w Capacitor, jeśli push na iOS okaże się za słaby. |
| Strona klienta | SSR w Workerze (Hono JSX) pod `/o/:token` | Otwiera się natychmiast z SMS-a, działa bez JS, ma podgląd linku (Open Graph). |
| API | Hono na Cloudflare Workers | Lekkie, typowane, ten sam runtime co reszta. |
| Baza | D1 (SQLite) + Drizzle | Wystarczy na długo (limit 10 GB na bazę w planie płatnym). Jedna baza, wszystkie zapytania filtrowane po `companyId`. |
| Pliki | R2 | Nagrania, zdjęcia, logo, PDF. Bez opłat za transfer. |
| Zadania w tle | Cloudflare Queues | Przetwarzanie AI poza żądaniem HTTP, ponawianie. |
| PDF | Browser Rendering (`@cloudflare/puppeteer`) renderuje `/o/:token?print=1` | Jeden szablon HTML dla strony i PDF. Wymaga płatnego planu Workers. |
| Auth | Better Auth (+ Drizzle adapter, pluginy phone number i email OTP) | Kody jednorazowe zamiast haseł, sesje w cookie. |
| SMS z kodami | SMSAPI.pl (albo inny polski operator) | Polskie numery, nadpis nadawcy. |
| E-mail | Resend (albo Cloudflare Email Service, jeśli dostępny na koncie) | Kody logowania, powiadomienia, wysyłka oferty mailem z serwera (opcjonalnie). |
| Mowa→tekst | interfejs `Transcriber`; domyślnie Workers AI `@cf/openai/whisper-large-v3-turbo` | Tanio, polski działa. Możliwość podmiany na innego dostawcę po testach na prawdziwych nagraniach z budowy. |
| LLM | Anthropic API, `claude-haiku-5-5`, tool use z JSON Schema | Tani, szybki, dobrze trzyma strukturę. |
| Płatności | do decyzji (patrz 08) | BLIK cykliczny i faktury VAT/KSeF trzeba sprawdzić. |

## Monorepo

```
wycenka/
├─ apps/
│  ├─ web/                 # React PWA
│  │  ├─ src/routes/       # trasy z docs/02-ekrany.md
│  │  ├─ src/components/   # Button, Card, Field, StatusPill, MoneyText, BottomNav, Sidebar…
│  │  ├─ src/offline/      # Dexie: kolejka nagrań i zdjęć, synchronizacja
│  │  ├─ src/lib/api.ts    # klient API (typy z packages/core)
│  │  └─ vite.config.ts
│  └─ worker/
│     ├─ src/index.ts      # Hono app + export queue() + scheduled()
│     ├─ src/api/          # trasy /api/*
│     ├─ src/client-page/  # JSX strony /o/:token (+ ?print=1 dla PDF)
│     ├─ src/jobs/         # processOffer, importPriceList, reminders, retention
│     ├─ src/ai/           # transcriber.ts, extractOffer.ts, extractPriceList.ts, prompts/
│     └─ wrangler.jsonc
├─ packages/
│  ├─ core/                # BEZ zależności od Cloudflare i Reacta
│  │  ├─ money.ts          # grosze, formatowanie pl-PL
│  │  ├─ geometry.ts       # ściany, podłoga, sufit, obwód, otwory
│  │  ├─ pricing.ts        # silnik wyceny (patrz 05)
│  │  ├─ schemas.ts        # zod: Extraction, OfferItem, PriceListItem, Rules…
│  │  ├─ nip.ts            # walidacja NIP
│  │  └─ templates/        # szablony branż (JSON, bez cen)
│  └─ db/
│     ├─ schema.ts         # Drizzle (patrz 04)
│     └─ migrations/
├─ docs/  mockups/  CLAUDE.md
└─ package.json            # pnpm workspaces, skrypty
```

## Jeden Worker, trzy wejścia

```ts
export default {
  fetch: app.fetch,                       // /api/*, /o/:token, reszta → static assets (SPA fallback na index.html)
  queue: handleQueue,                     // komunikaty: { type: 'process-offer', offerId } | { type: 'import-price-list', importId } | { type: 'render-pdf', offerId }
  scheduled: handleCron,                  // co godzinę: przypomnienia; codziennie 03:00: kasowanie nagrań > 30 dni, wygaszanie ofert
}
```

Bindingi w `wrangler.jsonc`: `DB` (D1), `FILES` (R2), `JOBS` (Queue producer + consumer), `BROWSER` (Browser Rendering), `AI` (Workers AI), `ASSETS` (static assets z `apps/web/dist`).
Sekrety: `ANTHROPIC_API_KEY`, `BETTER_AUTH_SECRET`, `SMSAPI_TOKEN`, `RESEND_API_KEY`, `PAYMENTS_*`, `APP_URL`, `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY`.

Lokalnie: `wrangler dev` (D1, R2 i Queues działają lokalnie przez Miniflare; Browser Rendering i Workers AI – zdalnie albo zaślepki za flagą `MOCK_AI=1`, `MOCK_PDF=1`).

## Offline i nagrania

- `MediaRecorder`: na Chrome/Android `audio/webm;codecs=opus`, na iOS Safari `audio/mp4`. Sprawdzaj `MediaRecorder.isTypeSupported` i zapisuj faktyczny MIME.
- Po „Gotowe – przygotuj ofertę”: oferta, nagrania i zdjęcia zapisane w Dexie z `clientId` (UUID z telefonu) → kolejka wysyłki.
- Wysyłka: `POST /api/offers` (idempotentne po `clientId`) → `PUT /api/offers/:id/files/:fileId` dla każdego pliku (strumieniowo do R2) → `POST /api/offers/:id/process`.
- Ponawianie: przy zdarzeniu `online`, przy starcie aplikacji, co 30 s gdy coś czeka, Background Sync tam, gdzie jest (Android). iOS nie ma Background Sync – stąd komunikat „wyślemy przy następnym otwarciu”.
- Pliki usuwamy z IndexedDB dopiero po potwierdzeniu zapisu w R2.
- Zdjęcia: kompresja w przeglądarce (canvas, max 1600 px, JPEG 0,8), usunięcie EXIF z lokalizacją.

## Przetwarzanie oferty (kolejka)

```
process-offer(offerId)
 1. status = processing, zdarzenie processing_started
 2. dla każdego nagrania: transcribe() → zapis transkrypcji w attachments
 3. extractOffer(transkrypcja, cennik, odpowiedzi na pytania) → walidacja zod (1 ponowienie przy błędzie)
 4. priceOffer(extraction, cennik, reguły, ustawienia oferty) → pozycje + sumy (packages/core, deterministycznie)
 5. zapis pozycji, pytań, sum; status = ready; zdarzenie processed
 6. web push „Oferta gotowa do sprawdzenia”
Błąd po ponowieniach → status = draft, processingError, push „Nie udało się – uzupełnij ręcznie”.
```

Odpowiedź na pytanie AI (`POST /api/offers/:id/answers`) ponownie uruchamia kroki 3–5 synchronicznie (bez STT – transkrypcja już jest). Ręczne zmiany pozycji przez fachowca (`locked=true`) nie są nadpisywane przy ponownym przeliczeniu.

## Strona klienta i bezpieczeństwo linku

- Token: 16 znaków base62 z `crypto.getRandomValues` (w makietach skrócony do `x7k2p9` tylko dla czytelności). Unikalny indeks.
- `/o/:token` – bez sesji. Nagłówki: `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, CSP bez zewnętrznych skryptów.
- Otwarcie: `POST /o/:token/opened` z beacona JS; pierwsze otwarcie zmienia status `sent → opened`. Nie liczymy User-Agentów botów (WhatsApp, facebookexternalhit, TelegramBot, Slackbot, Twitterbot, Googlebot).
- Akceptacja: `POST /o/:token/accept` (formularz HTML, działa bez JS) – zapis zdarzenia z datą, skrótem IP (SHA-256 z solą), User-Agent i sumą brutto w chwili akceptacji (dowód). Oferta po akceptacji jest zamrożona – edycja tworzy nową wersję (wersja 2) albo jest zablokowana (MVP).
- Rate limit na `/o/*` (np. Cloudflare Rate Limiting binding albo prosty licznik w D1).

## PDF

- Kolejka `render-pdf` po wysłaniu oferty (i na żądanie, jeśli brak). Puppeteer otwiera `APP_URL/o/:token?print=1`, `page.pdf({ format: 'A4', printBackground: true })`, zapis do R2 `pdf/{offerId}-{version}.pdf`.
- Nazwa pliku do pobrania: `Oferta-2026-11-014-Usługi-Glazurnicze-Nowak.pdf`.

## Powiadomienia

- Web Push (VAPID) z Service Workera PWA. Na iOS działa tylko dla aplikacji dodanej do ekranu głównego (iOS 16.4+) – w onboardingu po pierwszej ofercie podpowiedz „Dodaj do ekranu głównego, żeby dostawać powiadomienia”.
- Zapasowo: e-mail o akceptacji i pytaniu klienta.

## Multi-tenant i uprawnienia

- Każdy rekord biznesowy ma `companyId`. Middleware ustala `companyId` z sesji; każde zapytanie Drizzle filtruje po nim (helper `scoped(db, companyId)`).
- MVP: 1 użytkownik = 1 firma (rola `owner`). Model danych gotowy na wielu użytkowników (wersja 2).

## Jakość

- Vitest dla `packages/core` (obowiązkowo) i tras API (z Miniflare). Playwright – kilka testów ścieżki krytycznej (onboarding → oferta → akceptacja) na zaślepkach AI.
- ESLint + Prettier, `tsc --noEmit` w CI. GitHub Actions: lint, typecheck, test; deploy `wrangler deploy` z gałęzi `main`.
- Logi: bez danych osobowych (bez telefonów, adresów, transkrypcji). Błędy: Sentry dla Workers albo Workers Logs.
- Środowiska: `dev` (lokalnie), `staging` i `production` (osobne D1/R2/kolejki w `wrangler.jsonc` `env`).
