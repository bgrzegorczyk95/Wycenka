# 05. AI i silnik wyceny

Podział odpowiedzialności jest najważniejszą decyzją projektu:

| Kto | Co robi | Czego NIE robi |
|---|---|---|
| Mowa→tekst | zamienia nagranie na tekst | – |
| LLM (`claude-haiku-5-5`) | rozumie wypowiedź: pomieszczenia, wymiary, które pozycje cennika, zakres, czyj materiał, czego brakuje | nie podaje cen, nie liczy metraży, nie sumuje, nie dodaje prac, których fachowiec nie wymienił |
| Silnik wyceny (`packages/core/pricing.ts`) | geometria, ilości, ceny z cennika, dopłaty, rabat, VAT, sumy, walidacja | nie zgaduje – braki oznacza flagą |
| Fachowiec | sprawdza, uzupełnia, wysyła | – |

## 1. Transkrypcja

```ts
interface Transcriber {
  transcribe(audio: ArrayBuffer, mime: string, opts: { language: 'pl'; vocabularyHint?: string }): Promise<{ text: string; durationMs: number }>;
}
```

- Domyślnie Workers AI `@cf/openai/whisper-large-v3-turbo`, `language: 'pl'`. Jeśli model przyjmuje podpowiedź (`initial_prompt`), podaj nazwy pozycji z cennika fachowca – poprawia rozpoznawanie słów typu „hydroizolacja”, „stelaż”, „walk-in”.
- Kilka fragmentów nagrania → transkrypcje łączone w kolejności.
- Przed wyborem dostawcy na produkcję: nagraj 20 prawdziwych głosówek (auto, hałas, gwara) i porównaj 2–3 dostawców. Interfejs pozwala podmienić bez zmian w reszcie.

## 2. Ekstrakcja (LLM)

Wywołanie Anthropic Messages API z jednym narzędziem i `tool_choice: { type: 'tool', name: 'save_offer_draft' }`, `temperature: 0`.
Wynik walidowany schematem zod (ten sam co JSON Schema narzędzia). Błąd walidacji → jedno ponowienie z komunikatem błędu; drugi błąd → `processing_failed`.

### Wejście do modelu

- Cennik fachowca jako lista: `{ id, name, unit, measure, aliases }` (bez cen – model ich nie potrzebuje).
- Transkrypcja.
- Odpowiedzi na wcześniejsze pytania (jeśli to ponowne przeliczenie): `[{ question, answer }]`.

### Schemat wyniku (zod)

```ts
const Scope = z.enum(['walls', 'floor', 'walls_floor', 'ceiling', 'perimeter', 'count', 'manual']);

export const Extraction = z.object({
  title: z.string().max(60),                                   // „Remont łazienki”
  rooms: z.array(z.object({
    id: z.string(),                                            // 'r1'
    name: z.string(),                                          // „Łazienka”
    lengthM: z.number().nullable(),
    widthM: z.number().nullable(),
    heightM: z.number().nullable(),
    openings: z.array(z.object({
      kind: z.enum(['door', 'window']),
      widthM: z.number(), heightM: z.number(),
    })).nullable(),                                            // null = nie wspomniano → silnik przyjmie drzwi 0,8 × 2,0
  })),
  items: z.array(z.object({
    priceListItemId: z.string().nullable(),                    // null = brak w cenniku
    proposedName: z.string().nullable(),                       // wymagane, gdy priceListItemId = null
    roomId: z.string().nullable(),
    scope: Scope,
    count: z.number().int().positive().nullable(),             // dla scope = count
    manualQty: z.object({ value: z.number().positive(), unit: z.enum(['m2','mb','szt','kpl','h']) }).nullable(), // gdy fachowiec podał ilość wprost
    tileHeightM: z.number().nullable(),                        // „płytki do wysokości 2 m”; null = do sufitu
    mosaic: z.boolean(),
    quote: z.string(),                                         // dosłowny fragment transkrypcji
    fromAnswerTo: z.string().nullable(),                       // id pytania, jeśli pozycja wynika z odpowiedzi
  })),
  material: z.enum(['client', 'contractor', 'unknown']),
  outOfTown: z.boolean().nullable(),
  questions: z.array(z.object({
    id: z.string(),
    text: z.string().max(80),                                  // „Czy płytki także na podłodze?”
    kind: z.enum(['yes_no', 'number', 'choice']),
    options: z.array(z.string()).nullable(),
    unit: z.string().nullable(),
  })).max(3),
});
```

### Zasady w prompcie systemowym (po polsku)

1. Jesteś asystentem polskiego fachowca. Z transkrypcji oględzin tworzysz strukturę oferty. **Nie podajesz żadnych cen ani kwot.**
2. Dopasowuj prace wyłącznie do pozycji z podanego cennika (po nazwie i aliasach). Gdy praca nie ma odpowiednika – `priceListItemId: null` i krótka `proposedName` w stylu cennika („Montaż brodzika walk-in”).
3. **Nie dodawaj prac, których fachowiec nie wymienił.** Nawet oczywistych (gruntowanie, fugowanie).
4. Przy każdej pozycji `quote` = dosłowny, krótki fragment transkrypcji, z którego wynika.
5. Liczby mówione zamieniaj na metry: „dwa na trzy” → 2 i 3 m, „dwa sześćdziesiąt” → 2,6 m, „sto dwadzieścia” w kontekście płytek → format 60×120 (nie wymiar pomieszczenia).
6. Nie licz powierzchni – podaj tylko wymiary i `scope`. Silnik policzy.
7. Gdy brakuje informacji potrzebnej do wyceny wymienionej pracy – zadaj pytanie (maks. 3, krótkie, z gotowymi odpowiedziami). Nie pytaj o rzeczy, które da się przyjąć domyślnie (drzwi 80 cm).
8. Pozycje wynikające z odpowiedzi na pytanie oznacz `fromAnswerTo`.
9. „Materiał klienta”, „klient kupuje” → `material: client`; „z moim materiałem” → `contractor`; brak informacji → `unknown`.

Prompty trzymaj w `apps/worker/src/ai/prompts/*.ts` jako stałe z wersją (`PROMPT_VERSION`), zapisywaną przy ofercie.

## 3. Silnik wyceny (`packages/core`)

Czysta funkcja, bez I/O:

```ts
priceOffer(input: {
  extraction: Extraction;
  answers: Record<string, string>;
  priceList: PriceListItem[];          // z cenami
  rules: PricingRule[];
  overrides: OfferItemOverride[];      // ręczne zmiany fachowca (locked)
  vatBps: number | null;
  discount: { bps?: number; gr?: number } | null;
}): { geometry: RoomGeometry[]; items: PricedItem[]; netGr; vatGr; grossGr; missingPriceCount; warnings: string[] }
```

### Geometria (liczona w milimetrach, liczby całkowite)

- `perimeter = 2 × (L + W)`
- `wallsGross = perimeter × H` (albo `× tileHeight`, jeśli podano wysokość płytek)
- `openings`: gdy `null` → jedne drzwi **800 × 2000 mm**. Odejmowana powierzchnia otworu: `w × min(h, wysokość)`.
- `walls = wallsGross − Σ openings`
- `floor = ceiling = L × W`
- `perimeterTrim = perimeter − Σ szerokości drzwi` (mb, np. listwy, silikon)
- Pole w mm² → ilość w tysięcznych m²: `mm² / 1000`. Długość w mm → tysięczne mb: `mm`.
- Ilości m² i mb zaokrąglamy do **0,1** (100 tysięcznych) „połówki w górę”. `szt`, `kpl` – całkowite.

### Ilość według `scope`

| scope | ilość |
|---|---|
| `walls` | walls |
| `floor` | floor |
| `walls_floor` | walls + floor |
| `ceiling` | ceiling |
| `perimeter` | perimeterTrim |
| `count` | `count` (domyślnie 1) |
| `manual` | `manualQty` (wymagane) |

Jednostka z cennika musi pasować do scope (m² ↔ walls/floor/walls_floor/ceiling, mb ↔ perimeter, szt/kpl/h ↔ count/manual). Niezgodność → pozycja z ilością 1 i ostrzeżeniem do sprawdzenia.

### Nazwa pozycji na ofercie

`offerName ?? name` z cennika, a dla `scope = walls_floor` dopisek „ (ściany + podłoga)”. Przykład: cennik „Stelaż podtynkowy WC” → oferta „Montaż stelaża podtynkowego WC”; „Skucie płytek” → „Skucie płytek (ściany + podłoga)”. Dla pozycji spoza cennika – `proposedName` z modelu.

### Kwoty

1. `unitPriceGr` = cena z cennika (`null`, gdy brak → pozycja „Brak w cenniku”, poza sumą).
2. Dopłaty na pozycji (`surchargeBps`, sumowane):
   - mozaika: `item.mosaic && tag 'mosaic-eligible'` → `+bps` reguły `mosaic_surcharge`,
   - wysokość: `room.heightM > threshold` i pozycja ścienna (`walls`/`walls_floor`, tag `wall`) → `+bps` reguły `height_surcharge`.
3. `valueGr = round(qtyMilli × unitPriceGr × (10000 + surchargeBps) / (1000 × 10000))` – **licz w BigInt** (iloczyn przekracza `Number.MAX_SAFE_INTEGER`), zaokrąglenie połówki w górę.
4. Materiał wykonawcy: pozycje z tagiem `material` dostają narzut `material_markup`.
5. `subtotal = Σ valueGr` pozycji z ceną.
6. Dojazd: `outOfTown === true` i reguła `travel_fee` włączona → pozycja „Dojazd poza miasto” (`sourceKind: 'rule'`).
7. Minimalna kwota: `subtotal < min_order.amountGr` → pozycja „Dopłata do minimalnej kwoty zlecenia” = różnica.
8. Rabat: `bps` od subtotal (zaokrąglony) albo kwota.
9. `netGr = subtotal + reguły − rabat`; `vatGr = round(netGr × vatBps / 10000)`; `grossGr = netGr + vatGr`. VAT `null` → 0 i etykieta „zw.”.
10. `missingPriceCount` – liczba pozycji bez ceny. Wysyłka zablokowana, gdy > 0.

### Walidacja i ostrzeżenia (nie blokują, pokazujemy przy pozycji)

- Wymiary pomieszczenia poza 0,5–30 m albo wysokość poza 2,0–5,0 m → ostrzeżenie (i pytanie, jeśli model go nie zadał).
- Ilość > 500 m² na pomieszczenie albo > 50 szt. → ostrzeżenie „sprawdź ilość”.
- `priceListItemId`, którego nie ma w cenniku → traktuj jak `null`.
- `quote` nie występuje w transkrypcji (po normalizacji: małe litery, bez polskich znaków i interpunkcji) → znacznik „sprawdź źródło”.
- Pozycje `locked` (ręcznie zmienione) nie są nadpisywane przy przeliczeniu.

### Przykład – musi przejść jako test

Plik `docs/fixtures/lazienka-kowalska.json` zawiera cennik, transkrypcję, oczekiwany wynik modelu (po odpowiedzi „Tak” na pytanie o podłogę) i oczekiwane pozycje:

| Pozycja | Ilość | Cena | Wartość |
|---|---|---|---|
| Skucie płytek (ściany + podłoga) | 30,4 m² | 45,00 zł | 1 368,00 zł |
| Płytki 60×120 – ściany | 24,4 m² | 180,00 zł | 4 392,00 zł |
| Płytki – podłoga | 6,0 m² | 160,00 zł | 960,00 zł |
| Montaż stelaża podtynkowego WC | 1 kpl | 650,00 zł | 650,00 zł |
| Montaż brodzika walk-in | 1 kpl | brak → 900,00 zł po uzupełnieniu | 900,00 zł |

Przed uzupełnieniem ceny brodzika: netto 7 370,00 zł, VAT 8% 589,60 zł, brutto 7 959,60 zł, `missingPriceCount = 1`.
Po uzupełnieniu: netto 8 270,00 zł, VAT 661,60 zł, brutto 8 931,60 zł.
Geometria: 3,0 × 2,0 × 2,6 m → obwód 10 m, ściany 26,0 − 1,6 (drzwi) = 24,4 m², podłoga 6,0 m².

## 4. Import cennika

Ten sam wzorzec, inne narzędzie `save_price_list_candidates`:

```ts
z.array(z.object({
  name: z.string(), unit: z.enum(['m2','mb','szt','kpl','h']), priceGr: z.number().int().nonnegative(),
  category: z.string().nullable(), matchedPriceListItemId: z.string().nullable(), quote: z.string(),
}))
```

- **Głos**: transkrypcja → LLM (tu model **podaje** ceny, bo fachowiec je dyktuje – to jego cennik, nie zgadywanie).
- **Zdjęcie kartki / starej oferty**: obraz do modelu (wejście wizualne).
- **Excel/CSV**: parsowanie w przeglądarce (SheetJS), potem LLM tylko mapuje kolumny i nazwy. **PDF**: dokument do modelu.
- Porównanie z cennikiem robi kod: `new` (brak dopasowania), `changed` (inna cena – pokaż starą i nową), `unchanged`.
- Nic nie trafia do cennika bez kliknięcia „Dodaj n pozycji do cennika”.

## 5. Szablony branż

`packages/core/templates/<branża>.json` – lista prac **bez cen**, z `key`, `category`, `name`, `unit`, `measure`, `tags`, `aliases`.
Glazurnik jest gotowy w `docs/fixtures/szablon-glazurnik.json`. Pozostałe (malarz, elektryk, hydraulik, suche zabudowy, podłogi, okna i drzwi, ekipa remontowa) przygotuj w tym samym formacie, 8–15 pozycji każda – i pokaż właścicielowi do akceptacji przed wdrożeniem.

## 6. Koszty i limity

- Jedno przetworzenie = 1 transkrypcja (~1 min) + 1–2 wywołania Haiku. Loguj zużyte tokeny przy ofercie (`aiUsage` w zdarzeniu `processed`), żeby znać realny koszt oferty.
- Limit techniczny: maks. 5 min nagrań i 10 zdjęć na ofertę, maks. 30 przetworzeń na firmę na dobę (ochrona przed nadużyciem).
