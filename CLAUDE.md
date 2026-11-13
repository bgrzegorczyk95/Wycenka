# Wycenka – kontekst projektu dla Claude

Aplikacja dla polskich fachowców (glazurnik, malarz, elektryk, hydraulik, ekipy remontowe).
Fachowiec nagrywa u klienta ~1 min opisu głosem i robi kilka zdjęć. Po ok. 2 minutach klient dostaje link do oferty
z logo, pozycjami, ceną i przyciskiem „Akceptuję”. „Wycenka” to nazwa robocza.

Pełny opis: `docs/`. Makiety: `mockups/` (HTML do otwarcia w przeglądarce + PNG w `mockups/png/`).

## Zasady, których nie wolno łamać

1. **AI nigdy nie wymyśla cen.** Ceny pochodzą wyłącznie z cennika fachowca. Pozycja bez odpowiednika w cenniku
   dostaje `priceListItemId = null`, nie ma ceny, jest oznaczona „Brak w cenniku” i blokuje wysyłkę, dopóki fachowiec
   nie wpisze ceny albo jej nie usunie.
2. **AI nie liczy.** Model zwraca tylko strukturę (pomieszczenia, wymiary, które pozycje cennika, zakres).
   Metraże, ilości, kwoty, rabaty, VAT i sumy liczy deterministyczny kod w `packages/core` (pokryty testami).
3. **Pieniądze to liczby całkowite w groszach** (`number`, nigdy float w złotówkach). Ilości przechowujemy jako
   liczby całkowite w tysięcznych jednostki (`qtyMilli`). Zaokrąglanie: patrz `docs/05-ai-i-wycena.md`.
4. **Nic nie trafia do klienta bez kliknięcia fachowca.** AI przygotowuje szkic, wysyła zawsze człowiek.
5. **Przy każdej pozycji z AI zapisujemy źródło** – fragment wypowiedzi albo „z odpowiedzi na pytanie AI”.
6. **Działa przy słabym zasięgu.** Nagranie i zdjęcia najpierw lądują w IndexedDB, wysyłka idzie z kolejki.

## Język

- Interfejs, komunikaty, e-maile, PDF: **po polsku**. Teksty bierz z makiet (są dopracowane), nie wymyślaj nowych bez potrzeby.
- Kod, nazwy plików, tabel, kolumn, zmiennych, commity: **po angielsku**.
- Formaty: kwoty `8 931,60 zł` (spacja niełamiąca jako separator tysięcy, przecinek dziesiętny), daty `27.11.2026`,
  jednostki `m²`, `mb`, `szt.`, `kpl`, `h`. Strefa czasowa `Europe/Warsaw`. Używaj `Intl.NumberFormat('pl-PL')`.

## Stack

- **Frontend:** React + TypeScript + Vite, PWA (`vite-plugin-pwa`), Tailwind CSS v4, React Router, TanStack Query,
  react-hook-form + zod, Dexie (IndexedDB) do kolejki offline.
- **Backend:** jeden Cloudflare Worker z Hono: `/api/*` (JSON), `/o/:token` (strona oferty dla klienta renderowana
  na serwerze przez Hono JSX – bez logowania, bez dużego JS), reszta = statyczne pliki SPA (Workers Static Assets).
  W tym samym Workerze: konsument kolejki (przetwarzanie AI) i cron (przypomnienia, retencja nagrań).
- **Dane:** D1 + Drizzle ORM (migracje w repo), pliki w R2, Cloudflare Queues, Browser Rendering do PDF.
- **Auth:** Better Auth – logowanie kodem SMS (plugin phone number) i kodem e-mail. Bez haseł.
- **AI:** mowa→tekst przez interfejs `Transcriber` (domyślnie Workers AI Whisper), ekstrakcja przez Anthropic API,
  model `claude-haiku-5-5`, wymuszone narzędzie (tool use) z JSON Schema, walidacja zod.
- **Płatności:** do potwierdzenia (Stripe vs operator z BLIK cyklicznym) – patrz `docs/08-otwarte-kwestie.md`.

Szczegóły i uzasadnienia: `docs/03-architektura.md`.

## Struktura repo (docelowa)

```
apps/web/          React PWA (aplikacja fachowca, landing, logowanie)
apps/worker/       Hono: API, strona klienta /o/:token, kolejka, cron, PDF
packages/core/     czysty TS bez zależności od Cloudflare: silnik wyceny, geometria, pieniądze, schematy zod, szablony branż
packages/db/       schemat Drizzle + migracje D1
docs/              specyfikacja (czytaj przed większą zmianą)
mockups/           makiety – źródło prawdy dla wyglądu
```

## Komendy

```
pnpm install
pnpm dev            # Vite (http://localhost:5173, proxy /api i /o) + wrangler dev (http://localhost:8787)
pnpm build          # build SPA do apps/web/dist (serwowane przez Workera)
pnpm test           # vitest (packages/core + apps/worker) – silnik wyceny musi przechodzić zawsze
pnpm coverage       # vitest z pokryciem packages/core
pnpm typecheck      # tsc --noEmit we wszystkich pakietach
pnpm lint           # eslint + prettier --check
pnpm format         # prettier --write
pnpm db:generate    # drizzle-kit generate (packages/db/migrations)
pnpm db:migrate     # wrangler d1 migrations apply DB --local
```

Uwagi do narzędzi:
- TypeScript przypięty do 6.0.x – typescript-eslint nie wspiera jeszcze TS 7 (natywnego).
- pnpm blokuje skrypty instalacyjne; zatwierdzone są tylko `esbuild` i `workerd` (`allowBuilds` w `pnpm-workspace.yaml`).
- Bindingi `AI` (M5) i `BROWSER` (M6) dojdą później – działają tylko zdalnie i wymagają konta Cloudflare.

## Jak pracujemy

- Pracuj etapami z `docs/07-plan-prac.md`. Jeden etap = jedna gałąź i seria małych commitów.
  Na koniec etapu sprawdź kryteria akceptacji i napisz krótko, co zostało zrobione i co odłożone.
- Wygląd odwzorowuj z `mockups/*.html` (otwórz plik i czytaj style – to zwykły HTML z inline CSS).
  Tokeny kolorów i typografii są w `docs/02-ekrany.md` → „Wygląd”. Komponenty buduj raz i używaj wielokrotnie.
- Mobile first: telefon 390 px, przyciski min. 44 px wysokości, główny przycisk 56 px. Desktop to ta sama aplikacja
  z innym układem (sidebar + treść), nie osobny projekt.
- Silnik wyceny: najpierw test, potem kod. Fixture `docs/fixtures/lazienka-kowalska.json` musi dawać
  dokładnie 8 270,00 zł netto / 661,60 zł VAT / 8 931,60 zł brutto.
- Nie dodawaj zależności bez potrzeby. Przed dodaniem dużej biblioteki zapytaj.
- Sekrety tylko w `.dev.vars` (lokalnie) i `wrangler secret` (produkcja). Nigdy w repo.
- Dane klientów fachowca to dane osobowe (RODO): nie loguj treści nagrań, telefonów ani adresów.
- Gdy specyfikacja jest niejasna albo sprzeczna z makietą – zapytaj, zamiast zgadywać. Makieta wygrywa w sprawach wyglądu,
  `docs/` w sprawach logiki.
