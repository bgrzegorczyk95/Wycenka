# 06. API (Hono, `/api/*`)

Wszystkie trasy `/api/*` poza `/api/auth/*` wymagają sesji i działają w obrębie `companyId` z sesji.
Wejście i wyjście walidowane zod (`@hono/zod-validator`), schematy w `packages/core/schemas.ts` – współdzielone z frontendem.
Błędy: `{ error: { code: string, message: string /* po polsku, do pokazania */ } }`.

## Auth (Better Auth, montowane pod `/api/auth/*`)

| Metoda | Ścieżka | Opis |
|---|---|---|
| POST | `/api/auth/phone-number/send-otp` | wysyła kod SMS (limit: 3 na 10 min na numer, 10 na godzinę na IP) |
| POST | `/api/auth/phone-number/verify` | loguje lub zakłada konto |
| POST | `/api/auth/email-otp/send-verification-otp` | kod e-mailem |
| POST | `/api/auth/sign-in/email-otp` | logowanie kodem z e-maila |
| POST | `/api/auth/sign-out` | |

Dokładne ścieżki zależą od wersji Better Auth – sprawdź w dokumentacji pluginów. Po pierwszym logowaniu tworzymy pustą firmę i zwracamy `needsOnboarding: true`.

## Firma i onboarding

| Metoda | Ścieżka | Opis |
|---|---|---|
| GET | `/api/me` | użytkownik, firma, plan, wykorzystanie limitu (`{ used: 3, limit: 3, resetsAt }`), `needsOnboarding` |
| POST | `/api/onboarding/trades` | `{ trades: ['glazurnik'] }` → zwraca pozycje szablonów bez cen |
| POST | `/api/onboarding/rates` | `{ items: [{ templateKey, priceGr | null }], custom: [...] }` → tworzy cennik (tylko z ceną) i reguły domyślne |
| PATCH | `/api/company` | dane firmy i domyślne warunki |
| PUT | `/api/company/logo` | upload (image/png, image/jpeg, ≤ 2 MB) → R2 |

## Cennik

| Metoda | Ścieżka | Opis |
|---|---|---|
| GET | `/api/price-list` | pozycje + reguły + „ostatnio dodane z ofert” |
| POST | `/api/price-list/items` | dodaj |
| PATCH | `/api/price-list/items/:id` | zmień (cena, nazwa, jednostka, kategoria) |
| DELETE | `/api/price-list/items/:id` | archiwizuj (nie usuwaj – są w starych ofertach) |
| PUT | `/api/price-list/rules/:kind` | dopłaty i zasady |
| POST | `/api/price-list/imports` | `multipart`: `source=voice|photo|file` + plik → `{ importId }` (kolejka) |
| GET | `/api/price-list/imports/:id` | status + rozpoznane pozycje (`new` / `changed` / `unchanged`) |
| POST | `/api/price-list/imports/:id/apply` | `{ accept: [candidateIndex...] }` |
| GET | `/api/price-list/export.xlsx` | eksport do Excela |
| POST | `/api/price-list/templates` | dodaj szablon kolejnej branży |

## Oferty

| Metoda | Ścieżka | Opis |
|---|---|---|
| GET | `/api/offers?status=&q=` | lista do ekranu 1 (tytuł, klient, dzielnica, brutto, status) |
| GET | `/api/reminders` | aktywne przypomnienia (karta „Zadzwoń do…”) |
| POST | `/api/reminders/:id/snooze` | „Później” (+1 dzień) |
| POST | `/api/reminders/:id/done` | |
| POST | `/api/offers` | `{ clientUuid, client: { name, phone, address }, files: [{ fileId, kind, mime, durationMs?, caption? }] }` – idempotentne po `clientUuid`; **sprawdza limit planu** (`402 plan_limit`) |
| PUT | `/api/offers/:id/files/:fileId` | body = plik (strumień do R2), idempotentne |
| POST | `/api/offers/:id/process` | wrzuca do kolejki, `status = processing` |
| GET | `/api/offers/:id` | pełna oferta: pozycje, pytania, geometria, sumy, warunki, zdarzenia, transkrypcja, status przetwarzania (`step: uploaded|transcribed|matched|priced`) |
| POST | `/api/offers/:id/answers` | `{ answers: { q1: 'Tak' } }` → ponowne przeliczenie, zwraca ofertę |
| PATCH | `/api/offers/:id/geometry` | poprawka wymiarów → przeliczenie |
| POST | `/api/offers/:id/items` | ręczna pozycja (z cennika albo własna) |
| PATCH | `/api/offers/:id/items/:itemId` | ilość, cena, nazwa; `{ unitPriceGr, saveToPriceList: true }` dla „Brak w cenniku” |
| DELETE | `/api/offers/:id/items/:itemId` | |
| PATCH | `/api/offers/:id` | tytuł, materiał, rabat, VAT, warunki (ważność, zaliczka, start, uwagi) |
| POST | `/api/offers/:id/send` | `{ channel }` → wymaga `missingPriceCount = 0`; nadaje numer i token, `status = sent`, zdarzenie, kolejka PDF; zwraca `{ link, message, deepLink }` |
| POST | `/api/offers/:id/reject` | ręczne „odrzucona” |
| GET | `/api/offers/:id/pdf` | PDF (z R2; generuje, jeśli brak) |
| GET | `/api/files/:fileId` | podpisany dostęp do zdjęcia/nagrania (tylko własna firma) |

## Płatności i plan

| Metoda | Ścieżka | Opis |
|---|---|---|
| POST | `/api/billing/checkout` | `{ interval: 'month' | 'year' }` → URL płatności |
| POST | `/api/billing/portal` | zarządzanie subskrypcją, faktury |
| POST | `/api/billing/webhook` | webhook operatora (bez sesji, weryfikacja podpisu) → `companies.plan` |

## Powiadomienia

| Metoda | Ścieżka | Opis |
|---|---|---|
| POST | `/api/push/subscribe` | zapis subskrypcji Web Push |
| DELETE | `/api/push/subscribe` | |

## Strona klienta (bez sesji, poza `/api`)

| Metoda | Ścieżka | Opis |
|---|---|---|
| GET | `/o/:token` | HTML oferty (stan zależny od statusu: aktywna / zaakceptowana / wygasła) |
| GET | `/o/:token?print=1` | wersja do PDF |
| GET | `/o/:token/pdf` | pobranie PDF |
| POST | `/o/:token/opened` | beacon (pierwsze otwarcie → `opened`), ignoruje boty |
| POST | `/o/:token/accept` | formularz; zapis dowodu; przekierowanie na `/o/:token` (widok „Dziękujemy”) |
| GET | `/o/:token/pytanie` | formularz pytania |
| POST | `/o/:token/pytanie` | `{ text, phone? }` → zdarzenie, push + e-mail do fachowca |

## Statusy HTTP

`400` walidacja · `401` brak sesji · `402` limit planu (`plan_limit`) · `404` · `409` konflikt (np. edycja zaakceptowanej oferty) · `422` wysyłka z brakującymi cenami (`missing_prices`) · `429` limit żądań.
