# 08. Otwarte kwestie (do decyzji właściciela)

Claude: nie rozstrzygaj tych spraw sam. Gdy etap od nich zależy – zapytaj albo zrób rozwiązanie z zaślepką za interfejsem.

| # | Sprawa | Opcje | Blokuje |
|---|---|---|---|
| 1 | **Operator płatności** | Stripe Billing (karty, prosta integracja) vs polski operator z BLIK-iem cyklicznym (np. Przelewy24, Tpay, PayU). Sprawdzić, który obsługuje **subskrypcje BLIK** – makieta obiecuje „BLIK, karta lub przelew”. Opcja pośrednia: miesięcznie kartą, rocznie jednorazowo BLIK-iem. | M8 |
| 2 | **Faktury VAT i KSeF** | Sprawdzić aktualne obowiązki KSeF dla faktur B2B w 2026 r. Najprościej: wystawianie przez API programu do faktur zintegrowanego z KSeF (np. Fakturownia, inFakt) po webhooku płatności. | M8 |
| 3 | **Dostawca mowy→tekst** | Workers AI Whisper (domyślnie) vs inni dostawcy – test na 20 prawdziwych nagraniach z budowy. | M5 (produkcja) |
| 4 | **Dostawca SMS** do kodów logowania | SMSAPI.pl / inny; koszt jednego SMS-a, nadpis nadawcy „Wycenka”. | M2 (produkcja) |
| 5 | **Nazwa i domena** | „Wycenka” jest robocza. Link w SMS powinien być krótki (`wycenka.pl/o/…`). | M10 |
| 6 | **Stawki VAT** | Podpowiedź „ustal z księgową” zostaje. Czy pozwalać na różne stawki VAT w jednej ofercie (np. 8% robocizna, 23% materiał)? MVP: jedna stawka na ofertę. | M5 |
| 7 | **Ceny planów** | 59 zł / 590 zł / Ekipa od 99 zł – założenia do sprawdzenia w rozmowach z fachowcami. Trzymać w konfiguracji. | M8 |
| 8 | **RODO** | Polityka prywatności, umowa powierzenia z fachowcem, rejestr czynności – treści od właściciela (najlepiej z prawnikiem). Region danych: D1 z lokalizacją w UE (`jurisdiction: eu`, jeśli dostępne dla D1/R2). | M10 |
| 9 | **Zdjęcia w wycenie** | MVP: zdjęcia tylko jako dokumentacja. Czy później wysyłać je do modelu (rozpoznanie np. liczby punktów, stanu ścian)? | później |
| 10 | **Edycja wysłanej oferty** | MVP: zmiana po wysłaniu = „Wyślij ponownie” z tym samym linkiem i zdarzeniem `edited`. Wersjonowanie ofert – wersja 2. | M6 |
| 11 | **Szablony branż innych niż glazurnik** | Claude przygotuje propozycje list prac (bez cen) – właściciel zatwierdza. | M2 |

## Do zweryfikowania technicznie przed startem

- Aktualne limity i ceny: D1, R2, Queues, Browser Rendering, Workers AI (plan Workers Paid).
- Obsługa `MediaRecorder` i Web Push na aktualnym iOS (PWA dodana do ekranu głównego).
- Aktualne ścieżki i API pluginów Better Auth (phone number, email OTP) i adaptera Drizzle dla D1.
- Aktualna nazwa modelu i cennik Anthropic API (`claude-haiku-5-5`).
