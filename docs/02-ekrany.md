# 02. Ekrany

Każdy ekran ma makietę w `mockups/<Nazwa>.html` (otwórz w przeglądarce, linki działają) i zrzut `mockups/png/<Nazwa>.png`.
Makiety telefonu mają 390 px szerokości, desktopowe są płynne (projektowane na 1440 px).
Dane przykładowe są spójne we wszystkich makietach i w `docs/fixtures/lazienka-kowalska.json`.

## Wygląd (tokeny z makiet)

| Token | Wartość | Użycie |
|---|---|---|
| `bg` | `#F5F3EE` | tło aplikacji fachowca |
| `surface` | `#FFFFFF` | karty, pola, strona klienta |
| `ink` | `#1C2430` | tekst główny, przycisk ciemny |
| `ink-2` | `#3F4856` | tekst drugorzędny, etykiety pól |
| `muted` | `#5A6372` | podpisy, meta |
| `line` | `#E3DED4` | obramowania kart |
| `line-strong` | `#D5CFC3` | obramowania pól i przycisków drugorzędnych |
| `sand` | `#ECE8DF` | tła pomocnicze (transkrypcja, wiadomość) |
| `accent` | `#C2410C` | główne akcje, aktywne elementy (alternatywy testowane: `#1D4ED8`, `#0F766E`) |
| `accent-tint` | `#FDF1EA` | tło zaznaczonej opcji |
| `success` / `success-bg` | `#1E6B34` / `#E3F2E7` | akceptacja, „gotowe” |
| `warn` / `warn-bg` / `warn-line` | `#6B4A12` / `#FFF6E0` / `#E9C77A` | brak zasięgu, brak w cenniku, „czeka” |

- Fonty: **Space Grotesk** (nagłówki 28–34 px, 700), **Inter** (tekst 14–17 px).
- Promienie: karty 14–16 px, pola 10–12 px, główny przycisk 14 px. Pigułki statusu: pełne zaokrąglenie.
- Główny przycisk: wysokość 56 px, pełna szerokość na telefonie, tło `accent` albo `ink`.
- Strona klienta używa białego tła i zielonego przycisku „Akceptuję ofertę” (`success`) – to nie jest kolor marki fachowca.
- Ikony: proste liniowe SVG (styl Lucide) – można użyć `lucide-react`.

## Mapa ekranów i tras

| # | Ekran | Makieta | Trasa | Kto |
|---|---|---|---|---|
| 1 | Lista ofert | `Main` | `/oferty` | fachowiec |
| 2 | Oględziny (nowa oferta) | `Ogledziny` | `/oferty/nowa` | fachowiec |
| 3 | Edycja pozycji | `Pozycje` | `/oferty/:id` | fachowiec |
| 4 | Oferta u klienta | `Klient` | `/o/:token` (SSR) | klient |
| 5 | Wybór profesji (krok 1/3) | `Profesja` | `/start/profesja` | fachowiec |
| 6 | Wpisz stawki (krok 2/3) | `Stawki` | `/start/stawki` | fachowiec |
| 7 | Cennik | `Cennik` | `/cennik` | fachowiec |
| 8 | Import cennika | `Import` | `/cennik/import` | fachowiec |
| 9 | Komputer – panel ofert | `PanelOfert` | `/oferty` (≥1024 px) | fachowiec |
| 10 | Komputer – cennik | `CennikDesktop` | `/cennik` (≥1024 px) | fachowiec |
| 11 | Komputer – oferta u klienta | `KlientDesktop` | `/o/:token` (szeroki ekran) | klient |
| 12 | Strona startowa (telefon) | `Start` | `/` | gość |
| 13 | Logowanie (telefon) | `Logowanie` | `/logowanie` | gość |
| 14 | Strona startowa (komputer) | `StartDesktop` | `/` | gość |
| 15 | Logowanie (komputer) | `LogowanieDesktop` | `/logowanie` | gość |
| 16 | Dane firmy (krok 3/3) | `DaneFirmy` | `/start/firma` | fachowiec |
| 17 | AI układa ofertę | `Przetwarzanie` | `/oferty/:id` gdy `processing` | fachowiec |
| 18 | Brak zasięgu | `BrakZasiegu` | `/oferty/:id` gdy `queued` | fachowiec |
| 19 | Podgląd i wysyłka | `Wysylka` | `/oferty/:id/wysylka` | fachowiec |
| 20 | Klient – po akceptacji | `KlientAkceptacja` | `/o/:token` gdy `accepted` | klient |
| 21 | Klient – mam pytanie | `KlientPytanie` | `/o/:token/pytanie` | klient |
| 22 | Limit darmowego planu | `Limit` | `/plan` | fachowiec |
| 23 | Komputer – dane firmy | `DaneFirmyDesktop` | `/start/firma`, `/firma` | fachowiec |
| 24 | Komputer – podgląd i wysyłka | `WysylkaDesktop` | `/oferty/:id/wysylka` | fachowiec |

Ekrany 9–11, 14–15, 23–24 to te same trasy co wersje telefonowe – inny układ od szerokości ~1024 px (sidebar 220 px + treść).
Na komputerze nie ma nagrywania – w panelu ofert jest podpowiedź „Nagrywasz oględziny na telefonie”.

Nawigacja dolna na telefonie (ekrany 1, 7): **Oferty · Cennik · Firma**. Sidebar na komputerze: **Oferty · Cennik · Klienci · Firma i logo** („Klienci” – wersja 2, w MVP można ukryć).

---

## Szczegóły ekranów

### 1. Lista ofert (`Main`, desktop: `PanelOfert`)
- Nagłówek z nazwą firmy, tytuł „Oferty”.
- Karta przypomnienia (gdy jest): „Zadzwoń do Anny Kowalskiej – Otworzyła ofertę na łazienkę 3 dni temu i jeszcze nie odpowiedziała.” Przyciski **Zadzwoń** (`tel:`) i **Później** (odkłada o 1 dzień).
- „Ostatnie oferty”: tytuł, kwota brutto (albo „—” dla szkicu bez pozycji), klient · dzielnica, pigułka statusu.
- Stały przycisk **Nowa oferta** → sprawdza limit planu → `/oferty/nowa` albo `/plan`.
- Desktop: lista po lewej, szczegóły wybranej oferty po prawej (pozycje, historia zdarzeń, sumy, akcje: Edytuj pozycje, Wyślij ponownie, Pobierz PDF, Zobacz jak klient), wyszukiwarka, przycisk „+ Nowa oferta”.
- Stan pusty (brak makiety): krótki tekst + przycisk „Zrób pierwszą ofertę”.

### 2. Oględziny (`Ogledziny`)
- Pola: Klient (imię i nazwisko), Telefon, Adres. Wszystkie opcjonalne poza imieniem.
- Duży przycisk nagrywania z licznikiem czasu; podczas nagrywania pokazujemy na żywo tekst, jeśli przeglądarka daje rozpoznawanie mowy (opcjonalnie – nie jest wymagane). Podpowiedź: „Powiedz: pomieszczenie, wymiary, zakres prac i czyj materiał.”
- Można nagrać kilka fragmentów (dograj). Limit 5 min łącznie.
- Zdjęcia (aparat lub galeria), miniatury z podpisem, „Dodaj”. Kompresja w przeglądarce do ~1600 px, JPEG 0,8.
- **Gotowe – przygotuj ofertę** → zapis do IndexedDB → próba wysyłki → ekran 17 albo 18.
- Podpis: „AI ułoży pozycje z Twojego cennika. Ceny zawsze sprawdzasz Ty.”

### 17. AI układa ofertę (`Przetwarzanie`)
- Lista kroków z postępem: wysłano nagranie i zdjęcia → rozpoznano tekst → dopasowuję pozycje do cennika → liczę metraże i ceny.
- Sekcja „Co usłyszałem” z transkrypcją, gdy już jest.
- Komunikat, że można zamknąć aplikację – przyjdzie powiadomienie.
- Odpytywanie statusu co 2 s (albo SSE). Po `ready` przejście do ekranu 3.
- Błąd (brak makiety): „Nie udało się przygotować oferty” + „Spróbuj ponownie” + „Uzupełnij ręcznie”.

### 18. Brak zasięgu (`BrakZasiegu`)
- Pasek „Brak internetu”, karta „Nagranie zapisane w telefonie – nic nie przepadło”.
- Lista „Czeka na wysłanie (n)” z pigułką „Czeka”.
- **Spróbuj wysłać teraz**, **Wróć do ofert**. Kolejka wysyła sama po powrocie sieci (zdarzenie `online`, Background Sync tam, gdzie działa, i przy każdym otwarciu aplikacji).

### 3. Edycja pozycji (`Pozycje`)
- Nagłówek: tytuł, klient, link „Z nagrania 0:42” (odtworzenie).
- Podsumowanie geometrii: „3,0 × 2,0 m, wysokość 2,6 m · ściany 24,4 m² (po odjęciu drzwi) · podłoga 6,0 m²” – klik pozwala poprawić wymiary (przelicza pozycje).
- **Pytania AI** (0–3) jako karty: pytanie + szybkie odpowiedzi (Tak/Nie albo liczba). Po odpowiedzi: „Pytanie AI: „…” · Ty: Tak”. Odpowiedź uruchamia ponowne przeliczenie.
- Lista pozycji: nazwa, wartość, „ilość × cena”, źródło („z nagrania: „skuwamy stare płytki”” / „z odpowiedzi na pytanie AI”). Tap → edycja ilości, ceny, nazwy, usunięcie.
- Pozycja **Brak w cenniku** (pomarańczowa ramka): pole „Cena netto (zł)” + przełącznik „Zapisz w cenniku” (domyślnie włączony) → po zapisie pozycja trafia do cennika z oznaczeniem „nowa z oferty”.
- **+ Dodaj pozycję** (z cennika z wyszukiwarką albo własna).
- Materiał: przełącznik **Materiał klienta / Z moim materiałem**.
- Sumy: Netto (z dopiskiem „bez n pozycji”, gdy są braki), VAT, Brutto.
- Blokada: „Uzupełnij cenę brodzika, zanim wyślesz ofertę.” – przycisk **Dalej: podgląd i wysyłka** nieaktywny, dopóki są pozycje bez ceny.

### 19. Podgląd i wysyłka (`Wysylka`, desktop: `WysylkaDesktop`)
- Miniatura oferty (logo, nr, tytuł, liczba pozycji, brutto) + **Otwórz PDF**. Desktop: pełny podgląd A4 po lewej.
- Warunki: Ważna do (domyślnie dziś + ważność z ustawień), Zaliczka, Rozpoczęcie (tekst), Uwagi dla klienta.
- Kanał: **SMS / WhatsApp / E-mail** (zapamiętujemy ostatni wybór). Podgląd treści wiadomości z linkiem (edytowalny).
- **Wyślij ofertę** → zapis zdarzenia `sent`, status `sent`, potem otwarcie: `sms:<tel>?&body=…`, `https://wa.me/48…?text=…` albo `mailto:`. Gdy brak numeru – Web Share API.
- **Kopiuj link**, na desktopie także **Pobierz PDF**.
- Numer oferty nadawany przy pierwszej wysyłce: `RRRR/MM/NNN` (licznik per firma per miesiąc).

### 4. Oferta u klienta (`Klient`, desktop: `KlientDesktop`)
Renderowana na serwerze (Hono JSX), działa bez JS, `noindex`, tagi Open Graph (tytuł „Oferta: Remont łazienki – Usługi Glazurnicze Nowak”).
- Nagłówek firmy (logo albo inicjały), „Oferta nr … · ważna do …”.
- Tytuł, krótkie wprowadzenie („Pani Anno, poniżej zakres prac i cena po oględzinach z 13 listopada.” – generowane z szablonu, nie przez AI).
- Zakres prac: pozycje z ilością × ceną i wartością (desktop: tabela). Sumy netto, VAT, **Do zapłaty brutto**.
- Warunki: materiał, zaliczka, rozpoczęcie, uwagi.
- **Akceptuję ofertę** (zielony) → potwierdzenie (dialog „Akceptujesz ofertę na 8 931,60 zł?”) → POST → ekran 20.
- **Mam pytanie** → ekran 21. **Zadzwoń** (`tel:`). Desktop: **Pobierz PDF**.
- Stopka „Oferta przygotowana w aplikacji Wycenka” (tylko plan darmowy – w Pro bez stopki).
- Oferta wygasła: komunikat i przycisk „Zadzwoń”, bez akceptacji.
- Rejestracja otwarcia: beacon JS po załadowaniu strony (nie samo GET – boty podglądu linków WhatsApp/Messenger/SMS też pobierają stronę).

### 20. Klient – po akceptacji (`KlientAkceptacja`)
- „Dziękujemy, oferta zaakceptowana”, podsumowanie: tytuł, kwota, data i godzina akceptacji, zaliczka. **Pobierz PDF**, **Zadzwoń**.
- Ponowne otwarcie linku po akceptacji pokazuje ten widok.

### 21. Klient – mam pytanie (`KlientPytanie`)
- Gotowe pytania (chipy wstawiają tekst): „Kiedy możecie zacząć?”, „Ile potrwają prace?”, „Czy można zmienić zakres?”.
- Pole pytania (wymagane, maks. 1000 znaków), telefon kontaktowy (opcjonalny).
- **Wyślij pytanie** → zdarzenie `question`, powiadomienie fachowca, komunikat „Wysłano. Oferta pozostaje aktywna”.
- Ochrona przed spamem: limit 5 pytań na ofertę na dobę, honeypot.

### 5. Wybór profesji (`Profesja`)
- Krok 1 z 3. „Czym się zajmujesz?” – siatka kafelków (wielokrotny wybór): Glazurnik, Malarz, Elektryk, Hydraulik, Suche zabudowy, Podłogi, Okna i drzwi, Ekipa remontowa; „Inna profesja – opisz własnymi słowami” (wtedy szablon pusty).
- **Dalej** → `/start/stawki`.

### 6. Wpisz stawki (`Stawki`)
- Krok 2 z 3 · nazwa branży. Pozycje szablonu w kategoriach, pole ceny z jednostką (zł/m², zł/mb, zł/kpl).
- Szybki import: **Powiedz ceny**, **Zdjęcie kartki**, **Excel / PDF** (ten sam mechanizm co ekran 8).
- Licznik „Uzupełnione: 7 z 9”. „+ Dodaj własną pozycję”.
- **Zapisz i przejdź dalej** → zapisuje tylko pozycje z ceną → `/start/firma`.

### 16. Dane firmy (`DaneFirmy`, desktop: `DaneFirmyDesktop`)
- Krok 3 z 3. Logo (PNG/JPG, opcjonalne, przycinane do kwadratu, maks. 2 MB), Nazwa firmy, NIP (walidacja sumy kontrolnej), Telefon, (desktop: E-mail), Obszar działania.
- Domyślne warunki: Ważność (7/14/30 dni), Zaliczka (brak/20/30/50%), Stawka VAT (8% / 23% / zwolniony) z podpowiedzią „Stawkę ustal z księgową…”.
- Desktop: podgląd nagłówka oferty na żywo.
- **Gotowe – zrób pierwszą ofertę** → `/oferty`. Ten sam formularz służy później jako „Firma i logo”.

### 7. Cennik (`Cennik`, desktop: `CennikDesktop`)
- „Glazurnik · 11 pozycji”, wyszukiwarka, **+ Dodaj pozycję**, **Importuj**.
- Baner „Dodano z oferty „Łazienka – A. Kowalska”: Montaż brodzika walk-in · 900 zł/kpl” (ostatnio dodane z ofert).
- Filtry kategorii (chipy), lista: nazwa, cena, jednostka, znacznik „nowa”.
- **Dopłaty i zasady** (edytowalne): Mozaika i drobne formaty +20%, Wysokość powyżej 3 m +15%, Minimalna kwota zlecenia 500 zł, Dojazd poza miasto 100 zł, Materiał wykonawcy – narzut 10%.
- Desktop: edytowalna tabela (Pozycja, Kategoria, Jednostka, Cena netto) z edycją w komórce, **Eksport do Excela**, karta „Robisz też inne prace? Dodaj szablon innej branży”.

### 8. Import cennika (`Import`)
- Źródło: **Powiedz ceny** / **Zdjęcie kartki lub starej oferty** / **Plik Excel lub PDF**.
- Transkrypcja nagrania, potem „Rozpoznane pozycje” z oznaczeniem: **nowa**, **zmiana ceny** (stara → nowa), **bez zmian – już w cenniku**. Każdą można odznaczyć lub poprawić.
- Ostrzeżenie: „Sprawdź jednostki – AI rozpoznało je z nagrania.”
- **Dodaj n pozycji do cennika**.

### 12/14. Strona startowa (`Start`, `StartDesktop`)
- Hasło „Oferta dla klienta w 2 minuty. Prosto z oględzin.”, opis, **Wypróbuj za darmo**, „3 oferty miesięcznie za darmo. Bez karty.”
- Przykładowa oferta (karta), „Jak to działa” w 3 krokach, „Ile to kosztuje” (Darmowy, Pro, desktop także Ekipa), stopka z regulaminem i polityką prywatności.
- Bez zmyślonych opinii i statystyk. Statyczna strona – może być prerenderowana.

### 13/15. Logowanie (`Logowanie`, `LogowanieDesktop`)
- Numer telefonu z prefiksem +48 → **Wyślij kod** → pole „Kod z SMS-a” (6 cyfr, `autocomplete="one-time-code"`), „Wyślij ponownie za 0:42” (licznik 60 s) → **Zaloguj**.
- Alternatywa: **Zaloguj adresem e-mail** (kod e-mailem).
- „Nie masz konta? Załóż je w 2 minuty” – to ten sam formularz; nowe konto → `/start/profesja`, istniejące → `/oferty`.
- Desktop: po lewej trzy zdania o korzyściach, po prawej formularz.

### 22. Limit darmowego planu (`Limit`)
- „Wykorzystałeś 3 darmowe oferty w tym miesiącu”, pasek 3 z 3, „kolejne darmowe od 1 grudnia”.
- Karta Pro: 59 zł netto/mies., lista korzyści, przełącznik **Miesięcznie / Rocznie** (590 zł – 2 miesiące gratis), „Płatność: BLIK, karta lub przelew. Anulujesz w każdej chwili.”
- **Przejdź na Pro** → płatność (Checkout operatora) → powrót z potwierdzeniem. **Poczekam do 1 grudnia** → `/oferty`.
- „Twoje szkice, oferty i cennik zostają bez zmian.”

## Ekrany bez makiet (zrób prosto, w stylu reszty)

- Ustawienia konta (telefon, e-mail, wyloguj, usuń konto, plan i faktury).
- Szczegóły oferty po wysłaniu na telefonie (jak prawa kolumna `PanelOfert`).
- Stany błędów: brak połączenia z serwerem, błąd przetwarzania AI, link do oferty nieważny.
- Regulamin i polityka prywatności (treść dostarczy właściciel).
