# 01. Produkt

## W skrócie

Fachowiec nagrywa minutę głosówki i robi kilka zdjęć u klienta. Po ok. 2 minutach klient ma na telefonie ofertę
z logo, pozycjami, ceną i przyciskiem „Akceptuję”.

- **Dla kogo:** jednoosobowe firmy i małe ekipy remontowo-wykończeniowe (glazurnicy, malarze, elektrycy, hydraulicy, montażyści).
- **Obietnica:** profesjonalna oferta szybciej, niż zajmuje napisanie SMS-a z kwotą.
- **Zasada nr 1:** AI nigdy nie wymyśla cen. Bierze je wyłącznie z cennika fachowca i wyraźnie oznacza pozycje, których w cenniku brakuje.
- **Model zarabiania:** subskrypcja Pro ok. 59 zł netto/mies. (590 zł/rok), darmowy plan z 3 ofertami miesięcznie i stopką „zrobione w Wycence”.

## Użytkownicy

| Kto | Sytuacja | Czego potrzebuje |
|---|---|---|
| Fachowiec solo (główny klient MVP) | 3–10 wycen tygodniowo, oferty pisze wieczorem albo wysyła SMS z kwotą | Oferta w 2 minuty z telefonu, jeszcze u klienta albo w aucie |
| Szef małej ekipy (2–5 osób) – wersja 2 | Wycenia on albo brygadzista, cennik w Excelu albo w głowie | Wspólny cennik, oferty całej ekipy, statystyki |
| Klient (inwestor prywatny) | Porównuje 2–3 ekipy, często z partnerem | Czytelna oferta, możliwość zadania pytania, akceptacja jednym kliknięciem |

Płaci fachowiec. Klient nie zakłada konta i nic nie instaluje – otwiera link w przeglądarce.

## Główny przepływ

```
Fachowiec (PWA)                                   Serwer                         Klient (przeglądarka)
─────────────────                                 ──────                         ─────────────────────
Oględziny: dane klienta, nagranie, zdjęcia ──▶ kolejka ──▶ mowa→tekst
   (offline: czeka w telefonie)                        ──▶ AI: struktura + braki
                                                       ──▶ kod: metraże, ceny, sumy
Pozycje: sprawdza, uzupełnia brakujące ceny,
   odpowiada na 1–3 pytania AI
Podgląd i wysyłka: warunki, kanał (SMS/WhatsApp/e-mail) ─────────────────────▶ Oferta /o/:token
                                                                                 ├─ Akceptuję ─▶ potwierdzenie
Lista ofert: status Otwarta / Zaakceptowana   ◀── zdarzenia ◀───────────────────┤
Przypomnienie po 3 dniach ciszy                                                 └─ Mam pytanie ─▶ formularz
```

## Pierwsze uruchomienie (onboarding, 3 kroki)

1. **Profesja** – wybór jednej lub kilku branż. Daje gotową listę prac **bez cen** (nie podpowiadamy stawek).
2. **Stawki** – fachowiec wpisuje swoje ceny netto (ręcznie, głosem, ze zdjęcia kartki albo z Excela/PDF).
   Puste pozycje nie trafiają do cennika.
3. **Dane firmy** – logo (opcjonalnie), nazwa, NIP, telefon, obszar działania, domyślne warunki (ważność, zaliczka, VAT).

Potem lista ofert i przycisk „Nowa oferta”.

## Statusy oferty

| Status (kod) | Etykieta w UI | Kiedy |
|---|---|---|
| `draft` | Szkic | Utworzona, bez nagrania albo po edycji |
| `queued` | Szkic (czeka na wysłanie) | Nagranie czeka w telefonie na zasięg |
| `processing` | Szkic (AI układa) | W kolejce przetwarzania |
| `ready` | Szkic | Pozycje gotowe, czeka na sprawdzenie |
| `sent` | Wysłana | Fachowiec kliknął „Wyślij ofertę” |
| `opened` | Otwarta | Klient otworzył link (pierwsze otwarcie, bez botów podglądu linków) |
| `accepted` | Zaakceptowana | Klient kliknął „Akceptuję ofertę” |
| `rejected` | Odrzucona | Fachowiec oznaczył ręcznie (MVP) |
| `expired` | Wygasła | Minęła data ważności bez akceptacji |

Pytanie klienta nie zmienia statusu – tworzy zdarzenie i przypomnienie.

## Przypomnienia

- Klient otworzył ofertę (albo dostał ją) i nie odpowiedział przez 3 dni → karta „Zadzwoń do Anny Kowalskiej” na liście ofert + powiadomienie push.
- Klient zadał pytanie → natychmiastowe powiadomienie.
- Klient zaakceptował → natychmiastowe powiadomienie.

## Plany

| Plan | Cena netto | Co daje |
|---|---|---|
| Darmowy | 0 zł | 3 oferty miesięcznie, akceptacja online, stopka „Oferta przygotowana w aplikacji Wycenka”, bez logo |
| Pro | 59 zł/mies. albo 590 zł/rok | Oferty bez limitu, logo, bez stopki, przypomnienia, faktura VAT |
| Ekipa (wersja 2) | od 99 zł/mies. | Kilka osób, wspólny cennik, statystyki |

- Limit liczy oferty, które przeszły przetwarzanie AI w danym miesiącu kalendarzowym (Europe/Warsaw).
  Sprawdzany przy „Nowa oferta” – po przekroczeniu pokazujemy ekran 22 (Limit). Szkice, oferty i cennik zostają.
- Ceny to założenia do sprawdzenia w rozmowach z fachowcami – trzymaj je w konfiguracji, nie w kodzie UI.

## Zakres MVP i dalsze etapy

| Funkcja | Etap |
|---|---|
| Logowanie kodem SMS / e-mail, onboarding 3 kroki | MVP |
| Cennik z kategoriami, dopłatami; import głosem, ze zdjęcia, z Excela/PDF | MVP |
| Nagranie + zdjęcia → pozycje (offline-first) | MVP |
| Pytania AI o braki (1–3), inline na ekranie pozycji | MVP |
| Edycja pozycji, materiał klienta / z materiałem, rabat | MVP |
| Podgląd, PDF z logo, wysyłka linku (SMS / WhatsApp / e-mail) | MVP |
| Strona klienta: akceptacja z zapisem daty, „Mam pytanie” | MVP |
| Statusy, historia zdarzeń, przypomnienia | MVP |
| Plan darmowy z limitem, Pro z płatnością | MVP |
| Landing (strona startowa) | MVP |
| Warianty oferty do wyboru przez klienta | Wersja 2 |
| Aneksy do zakresu akceptowane przez klienta | Wersja 2 |
| Lista zakupów materiałów z oferty | Wersja 2 |
| Konto Ekipa, wspólny cennik, statystyki | Wersja 2 |
| Karta klienta, ustawienia konta, centrum powiadomień | Wersja 2 (brak makiet) |
| Protokół odbioru, zaliczki online, eksport do programu do faktur | Później |
| Natywna aplikacja (Capacitor) | Później |

## Czego NIE robimy w MVP

- Nie analizujemy zdjęć przez AI do wyceny (zdjęcia są dokumentacją dla klienta i fachowca). Flaga na później.
- Nie wysyłamy SMS-ów z serwera w imieniu fachowca – wysyłka idzie przez aplikacje w jego telefonie (`sms:`, WhatsApp, `mailto:`) albo Web Share API. SMS-y serwerowe tylko do kodów logowania.
- Nie robimy natywnych aplikacji ani sklepu z aplikacjami.
