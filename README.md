# Wycenka – paczka startowa

Wszystko, czego Claude Code potrzebuje, żeby zbudować aplikację: opis produktu, makiety, architektura, model danych,
logika AI i wyceny, API, plan prac i złoty przykład do testów.

## Zawartość

| Plik / folder | Co to jest |
|---|---|
| `CLAUDE.md` | Kontekst i zasady projektu – Claude Code czyta go automatycznie przy każdej sesji |
| `START_PROMPT.md` | Pierwszy prompt do wklejenia + szablony kolejnych |
| `docs/01-produkt.md` | Opis aplikacji, użytkownicy, przepływ, statusy, plany, zakres MVP |
| `docs/02-ekrany.md` | 24 ekrany: trasy, elementy, akcje, stany + tokeny wyglądu |
| `docs/03-architektura.md` | Stack (React PWA + Cloudflare Workers/D1/R2/Queues), struktura repo, offline, PDF, bezpieczeństwo |
| `docs/04-model-danych.md` | Schemat bazy (Drizzle) |
| `docs/05-ai-i-wycena.md` | Podział AI ↔ kod, schemat ekstrakcji, prompt, silnik wyceny, zaokrąglanie |
| `docs/06-api.md` | Endpointy |
| `docs/07-plan-prac.md` | Etapy M0–M10 z kryteriami „gotowe gdy” |
| `docs/08-otwarte-kwestie.md` | Decyzje, które musisz podjąć Ty (płatności, KSeF, SMS, nazwa…) |
| `docs/fixtures/lazienka-kowalska.json` | Złoty przykład: łazienka → 8 931,60 zł brutto, do testów |
| `docs/fixtures/szablon-glazurnik.json` | Szablon branży (lista prac bez cen + domyślne dopłaty) |
| `mockups/index.html` | Spis makiet – otwórz w przeglądarce, linki między ekranami działają |
| `mockups/*.html` | 24 makiety (16 na telefon, 8 na komputer) |
| `mockups/png/*.png` | Zrzuty makiet (Claude Code czyta obrazy) |

## Jak zacząć

1. Zainstaluj: Node.js 22+, pnpm (`npm i -g pnpm`), VS Code z rozszerzeniem Claude Code.
2. Rozpakuj paczkę do pustego folderu, np. `~/projekty/wycenka`, i zrób `git init` + pierwszy commit.
3. Otwórz folder w VS Code, uruchom Claude Code.
4. Wklej prompt z `START_PROMPT.md`. Claude najpierw zada pytania – odpowiedz, potem zrobi etapy M0 i M1.
5. Kolejne etapy zlecaj po jednym (szablon promptu w `START_PROMPT.md`).

## Uruchomienie lokalnie (od M0)

```
npm i -g pnpm        # jeśli nie masz pnpm (corepack na Windows wymaga uprawnień administratora)
pnpm install
cp apps/worker/.dev.vars.example apps/worker/.dev.vars   # i wpisz BETTER_AUTH_SECRET (komenda w pliku)
pnpm db:migrate      # lokalna baza D1 (Miniflare)
pnpm dev             # aplikacja: http://localhost:5173, Worker: http://localhost:8787
```

Konto Cloudflare nie jest potrzebne do pracy lokalnej – D1, R2 i kolejki działają na komputerze.

**Logowanie lokalnie:** bez `SMSAPI_TOKEN` / `RESEND_API_KEY` kody nie są wysyłane, tylko wypisywane
w konsoli `pnpm dev`, np. `[dev sms] to +48•••••0000: Wycenka: kod logowania 123456…`.
Limit to 3 kody na 10 minut z jednego IP; żeby go wyczyścić lokalnie:
`cd apps/worker && npx wrangler d1 execute DB --local --command "delete from rate_limit"`.

Przed commitem: `pnpm test`, `pnpm typecheck`, `pnpm lint`. Plik `apps/worker/.dev.vars` jest w `.gitignore`.

Struktura: `apps/web` (PWA), `apps/worker` (Hono: API, strona klienta, kolejka, cron),
`packages/core` (silnik wyceny, bez zależności od Cloudflare), `packages/db` (Drizzle + migracje D1).

## Konta, które będą potrzebne (nie od razu)

| Kiedy | Konto |
|---|---|
| M0 | Cloudflare (na start wystarczy darmowe; Browser Rendering i część limitów wymagają planu Workers Paid – sprawdź aktualny cennik) |
| M5 | Anthropic API (klucz w `.dev.vars` jako `ANTHROPIC_API_KEY`) |
| M2 (produkcja) | Bramka SMS (np. SMSAPI.pl), e-mail (np. Resend) |
| M8 | Operator płatności – patrz `docs/08-otwarte-kwestie.md` |

Makiety są też na żywej tablicy: https://claude.ai/artifact/DgaC1JtsCreXFYQyqMB9wG
