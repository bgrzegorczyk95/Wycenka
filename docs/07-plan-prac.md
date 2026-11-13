# 07. Plan prac

Każdy etap kończy się działającym, przetestowanym kawałkiem. Kolejność jest celowa: najpierw rdzeń (silnik wyceny),
potem ścieżka krytyczna fachowiec → klient, na końcu płatności i dodatki.
Przy każdym etapie: przeczytaj wskazane pliki z `docs/` i makiety, zaplanuj, zaimplementuj, przetestuj, podsumuj.

## M0. Szkielet repo
- pnpm workspaces: `apps/web`, `apps/worker`, `packages/core`, `packages/db`. TypeScript strict, ESLint, Prettier, Vitest.
- Vite + React + React Router + TanStack Query + Tailwind v4 z tokenami z `docs/02-ekrany.md`. Fonty Inter i Space Grotesk (self-hosted przez `@fontsource`).
- Worker Hono z `/api/health`, Workers Static Assets z `apps/web/dist`, SPA fallback.
- D1 + Drizzle (pusta migracja), R2, Queue – w `wrangler.jsonc` (dev).
- `pnpm dev` uruchamia oba; README z komendami; uzupełnij sekcję komend w `CLAUDE.md`.
- **Gotowe gdy:** `pnpm dev`, `pnpm test`, `pnpm typecheck`, `pnpm lint` przechodzą; strona pokazuje pusty layout w kolorach makiet.

## M1. Silnik wyceny (`packages/core`)
- `money.ts` (grosze, `formatPLN`, `formatQty`), `geometry.ts`, `pricing.ts`, `schemas.ts` (zod z `05`), `nip.ts`.
- Testy z `docs/fixtures/lazienka-kowalska.json` (główny przykład + `extraCasesToTest`). Najpierw testy, potem kod.
- **Gotowe gdy:** wszystkie przypadki z fixture przechodzą, 100% pokrycia `pricing.ts` i `geometry.ts`.

## M2. Logowanie i onboarding
- Schemat DB (`04`), migracje. Better Auth z kodem SMS i e-mail (w dev: kod w logach zamiast SMS).
- Ekrany 12–15 (start, logowanie – telefon i komputer), 5, 6, 16, 23. Szablon glazurnika + pozostałe szablony do akceptacji.
- **Gotowe gdy:** nowy numer → profesja → stawki → dane firmy → pusta lista ofert; ponowne logowanie → lista ofert.

## M3. Cennik
- Ekran 7 (telefon) i 10 (tabela na komputerze), dopłaty i zasady, dodawanie, edycja, archiwizacja, wyszukiwanie, filtry kategorii, eksport do Excela.
- **Gotowe gdy:** zmiany w cenniku zapisują się i są widoczne na obu układach.

## M4. Oględziny offline
- Ekran 2: dane klienta, nagrywanie (MediaRecorder, dogrywanie, licznik), zdjęcia z kompresją, kolejka Dexie, upload do R2, ekran 18 (brak zasięgu).
- **Gotowe gdy:** nagranie zrobione w trybie samolotowym wysyła się samo po włączeniu sieci; nic nie ginie po zamknięciu karty.

## M5. Przetwarzanie AI i edycja pozycji
- Kolejka `process-offer`, `Transcriber` (Workers AI), `extractOffer` (Anthropic, tool use), silnik z M1. Tryb `MOCK_AI=1` zwracający fixture.
- Ekran 17 (postęp), ekran 3 (pozycje, pytania AI, brak w cenniku + „Zapisz w cenniku”, materiał, sumy, blokada wysyłki), poprawka wymiarów.
- **Gotowe gdy:** nagranie z fixture (albo podobne nagrane samemu) daje pozycje z fixture; odpowiedź „Tak” dodaje podłogę; wpisanie 900 zł daje 8 931,60 zł brutto.

## M6. Wysyłka i strona klienta
- Ekran 19 i 24 (podgląd, warunki, kanały, numer oferty, token, deep linki `sms:`/`wa.me`/`mailto:`, Web Share, kopiuj link).
- Strona `/o/:token` (ekrany 4, 11, 20, 21) w Hono JSX, beacon otwarcia, akceptacja z dowodem, pytanie klienta, Open Graph.
- PDF przez Browser Rendering (`MOCK_PDF=1` w dev).
- **Gotowe gdy:** oferta wysłana z telefonu otwiera się na drugim telefonie, akceptacja zmienia status u fachowca, PDF wygląda jak strona.

## M7. Lista ofert, panel i przypomnienia
- Ekran 1 i 9 (lista, szczegóły i historia na komputerze), karta przypomnienia, cron „3 dni bez odpowiedzi”, Web Push (VAPID) + e-mail zapasowy, wygaszanie ofert po terminie.
- **Gotowe gdy:** po akceptacji i pytaniu klienta przychodzi push; przypomnienie pojawia się po 3 dniach (test z podmienionym zegarem).

## M8. Plany i płatności
- Liczenie limitu (3 oferty/mies.), ekran 22, stopka na ofercie w planie darmowym, logo tylko w Pro.
- Integracja z wybranym operatorem płatności (decyzja z `08`), webhook, portal klienta, faktury.
- **Gotowe gdy:** 4. oferta w miesiącu pokazuje ekran 22; po opłaceniu (tryb testowy operatora) limit znika.

## M9. Import cennika
- Ekran 8 i skróty na ekranie 6: głos, zdjęcie, Excel/CSV, PDF → kandydaci (`new` / `changed` / `unchanged`) → zatwierdzenie.
- **Gotowe gdy:** podyktowanie „hydroizolacja trzydzieści pięć za metr, fuga epoksydowa sześćdziesiąt za metr, silikonowanie piętnaście za metr bieżący, skuwanie bez zmian” daje 3 nowe pozycje i 1 bez zmian (jak w makiecie).

## M10. Gotowość do startu
- Regulamin, polityka prywatności, umowa powierzenia (treści od właściciela), usuwanie konta, kasowanie nagrań po 30 dniach.
- Rate limiting, nagłówki bezpieczeństwa, CSP, monitoring błędów, środowisko staging, deploy produkcyjny, domena.
- Manifest PWA, ikony, ekran „Dodaj do ekranu głównego”, test na iPhonie (Safari) i Androidzie (Chrome).
- Test Playwright całej ścieżki na zaślepkach AI.

## Później (nie zaczynaj bez decyzji właściciela)
Warianty oferty, aneksy, lista zakupów, konto Ekipa, statystyki, protokół odbioru, płatność zaliczki online, eksport do programu do faktur, Capacitor.
