# 04. Model danych (D1 + Drizzle)

Konwencje:
- Id: tekst (`ulid` albo `crypto.randomUUID()`), czasy: `integer` ms od epoki (UTC), wyświetlanie w `Europe/Warsaw`.
- Kwoty: `integer` w groszach (`…Gr`). Ilości: `integer` w tysięcznych (`qtyMilli`, 30,4 m² = `30400`). Procenty: `integer` w punktach bazowych (`bps`, 20% = `2000`).
- Każda tabela biznesowa ma `companyId` i indeks po nim.
- Tabele Better Auth (`user`, `session`, `account`, `verification`) generuje Better Auth – nie duplikuj ich. `user` rozszerzamy o `companyId` i `role`.

Szkic (do dopracowania przez Claude Code w `packages/db/schema.ts`):

```ts
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),                       // „Usługi Glazurnicze Nowak”
  nip: text('nip'),
  phone: text('phone'),
  email: text('email'),
  serviceArea: text('service_area'),                  // „Warszawa i okolice”
  logoKey: text('logo_key'),                          // R2
  trades: text('trades', { mode: 'json' }).$type<string[]>().notNull(), // ['glazurnik']
  defaultValidityDays: integer('default_validity_days').notNull().default(14),
  defaultDepositBps: integer('default_deposit_bps').notNull().default(3000),
  defaultVatBps: integer('default_vat_bps'),          // 800 | 2300 | null = zwolniony
  plan: text('plan', { enum: ['free', 'pro', 'team'] }).notNull().default('free'),
  planRenewsAt: integer('plan_renews_at'),
  offerCounterMonth: text('offer_counter_month'),     // '2026-11'
  offerCounter: integer('offer_counter').notNull().default(0),
  createdAt: integer('created_at').notNull(),
});

export const priceListItems = sqliteTable('price_list_items', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  category: text('category').notNull(),               // 'Przygotowanie' | 'Płytki' | 'Montaż' | …
  name: text('name').notNull(),                       // „Płytki 60×120 – ściany” (nazwa w cenniku)
  offerName: text('offer_name'),                      // nazwa na ofercie, gdy inna: „Montaż stelaża podtynkowego WC”
  unit: text('unit', { enum: ['m2', 'mb', 'szt', 'kpl', 'h'] }).notNull(),
  priceGr: integer('price_gr').notNull(),             // netto
  measure: text('measure', {                           // jak liczyć ilość z geometrii
    enum: ['walls', 'floor', 'walls_floor', 'ceiling', 'perimeter', 'count', 'manual'] }).notNull(),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]), // ['tiles','wall','mosaic-eligible']
  aliases: text('aliases', { mode: 'json' }).$type<string[]>().notNull().default([]), // „skuwanie”, „skucie glazury”
  includesMaterial: integer('includes_material', { mode: 'boolean' }).notNull().default(false),
  source: text('source', { enum: ['template', 'manual', 'import', 'offer'] }).notNull(),
  sourceOfferId: text('source_offer_id'),             // „Dodano z oferty …”
  templateKey: text('template_key'),                  // klucz z szablonu branży
  archivedAt: integer('archived_at'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, t => [index('pli_company').on(t.companyId)]);

export const pricingRules = sqliteTable('pricing_rules', {   // „Dopłaty i zasady”
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  kind: text('kind', { enum: ['mosaic_surcharge', 'height_surcharge', 'min_order', 'travel_fee', 'material_markup'] }).notNull(),
  label: text('label').notNull(),                     // „Mozaika i drobne formaty”
  bps: integer('bps'),                                // +20% → 2000
  amountGr: integer('amount_gr'),                     // 500 zł → 50000
  thresholdMilli: integer('threshold_milli'),         // wysokość 3 m → 3000
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
}, t => [index('pr_company').on(t.companyId)]);

export const clients = sqliteTable('clients', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  name: text('name').notNull(),                       // „Anna Kowalska”
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  district: text('district'),                         // „Mokotów” (do listy ofert)
  createdAt: integer('created_at').notNull(),
}, t => [index('cl_company').on(t.companyId)]);

export const offers = sqliteTable('offers', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  clientId: text('client_id'),
  createdByUserId: text('created_by_user_id').notNull(),
  clientUuid: text('client_uuid').notNull(),          // idempotencja z telefonu
  number: text('number'),                             // '2026/11/014' – nadawany przy wysyłce
  title: text('title').notNull(),                     // „Remont łazienki”
  status: text('status', { enum: ['draft','queued','processing','ready','sent','opened','accepted','rejected','expired'] }).notNull(),
  token: text('token'),                               // link klienta
  material: text('material', { enum: ['client', 'contractor'] }).notNull().default('client'),
  geometry: text('geometry', { mode: 'json' }).$type<RoomGeometry[]>(),  // patrz 05
  validUntil: text('valid_until'),                    // '2026-11-27'
  depositBps: integer('deposit_bps'),
  startText: text('start_text'),                      // „od 2 grudnia 2026”
  notesForClient: text('notes_for_client'),
  discountBps: integer('discount_bps'),
  discountGr: integer('discount_gr'),
  vatBps: integer('vat_bps'),                         // null = zwolniony
  netGr: integer('net_gr'), vatGr: integer('vat_gr'), grossGr: integer('gross_gr'),
  missingPriceCount: integer('missing_price_count').notNull().default(0),
  sendChannel: text('send_channel', { enum: ['sms', 'whatsapp', 'email', 'link'] }),
  aiQuestions: text('ai_questions', { mode: 'json' }).$type<AiQuestion[]>(),
  aiExtraction: text('ai_extraction', { mode: 'json' }),  // surowy wynik modelu (do debugowania)
  processingError: text('processing_error'),
  countedForPlanMonth: text('counted_for_plan_month'),    // '2026-11' – limit planu darmowego
  sentAt: integer('sent_at'), openedAt: integer('opened_at'), acceptedAt: integer('accepted_at'),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, t => [
  index('of_company_status').on(t.companyId, t.status),
  uniqueIndex('of_token').on(t.token),
  uniqueIndex('of_client_uuid').on(t.companyId, t.clientUuid),
]);

export const offerItems = sqliteTable('offer_items', {
  id: text('id').primaryKey(),
  offerId: text('offer_id').notNull(),
  companyId: text('company_id').notNull(),
  priceListItemId: text('price_list_item_id'),        // null = „Brak w cenniku”
  name: text('name').notNull(),                       // kopia nazwy (cennik może się zmienić)
  unit: text('unit').notNull(),
  qtyMilli: integer('qty_milli').notNull(),
  unitPriceGr: integer('unit_price_gr'),              // kopia ceny z cennika w chwili wyceny; null gdy brak
  surchargeBps: integer('surcharge_bps').notNull().default(0), // suma dopłat zastosowanych do pozycji
  valueGr: integer('value_gr'),                       // wyliczone przez silnik
  scope: text('scope'),                               // 'walls' | 'floor' | 'walls_floor' | …
  sourceKind: text('source_kind', { enum: ['transcript', 'ai_answer', 'manual', 'rule'] }).notNull(),
  sourceQuote: text('source_quote'),                  // „skuwamy stare płytki”
  locked: integer('locked', { mode: 'boolean' }).notNull().default(false), // ręcznie poprawiona
  sortOrder: integer('sort_order').notNull(),
}, t => [index('oi_offer').on(t.offerId)]);

export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(),
  offerId: text('offer_id').notNull(),
  companyId: text('company_id').notNull(),
  kind: text('kind', { enum: ['audio', 'photo'] }).notNull(),
  r2Key: text('r2_key').notNull(),
  mime: text('mime').notNull(),
  durationMs: integer('duration_ms'),
  caption: text('caption'),                           // „Wanna”, „Płytki”, „WC”
  visibleToClient: integer('visible_to_client', { mode: 'boolean' }).notNull().default(false),
  transcript: text('transcript'),
  uploadedAt: integer('uploaded_at'),
  deletedAt: integer('deleted_at'),                   // nagrania kasowane po 30 dniach
});

export const offerEvents = sqliteTable('offer_events', {   // historia + dowód akceptacji
  id: text('id').primaryKey(),
  offerId: text('offer_id').notNull(),
  companyId: text('company_id').notNull(),
  type: text('type', { enum: ['created','queued','processing_started','processed','processing_failed','edited',
    'sent','opened','question','accepted','rejected','expired','reminder'] }).notNull(),
  channel: text('channel'),
  payload: text('payload', { mode: 'json' }),         // pytanie klienta, kwota przy akceptacji, ipHash, userAgent
  createdAt: integer('created_at').notNull(),
}, t => [index('oe_offer').on(t.offerId)]);

export const reminders = sqliteTable('reminders', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  offerId: text('offer_id').notNull(),
  kind: text('kind', { enum: ['no_response', 'client_question', 'accepted'] }).notNull(),
  dueAt: integer('due_at').notNull(),
  doneAt: integer('done_at'),
  snoozedUntil: integer('snoozed_until'),
});

export const priceListImports = sqliteTable('price_list_imports', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  source: text('source', { enum: ['voice', 'photo', 'file'] }).notNull(),
  r2Key: text('r2_key').notNull(),
  status: text('status', { enum: ['queued', 'processing', 'ready', 'applied', 'failed'] }).notNull(),
  result: text('result', { mode: 'json' }),           // rozpoznane pozycje: new | changed | unchanged
  createdAt: integer('created_at').notNull(),
});

export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  endpoint: text('endpoint').notNull(),
  keys: text('keys', { mode: 'json' }).notNull(),
  createdAt: integer('created_at').notNull(),
});

export const subscriptions = sqliteTable('subscriptions', {  // płatności – kształt zależny od operatora
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  provider: text('provider').notNull(),
  providerCustomerId: text('provider_customer_id'),
  providerSubscriptionId: text('provider_subscription_id'),
  interval: text('interval', { enum: ['month', 'year'] }).notNull(),
  status: text('status').notNull(),
  currentPeriodEnd: integer('current_period_end'),
});
```

## Relacje w skrócie

```
company 1─* user (MVP: 1)
company 1─* price_list_items, pricing_rules, clients, offers, price_list_imports
offer   1─* offer_items ─? price_list_item
offer   1─* attachments, offer_events, reminders
```

## Zasady

- Cena w `offer_items.unitPriceGr` to **kopia** z cennika w chwili wyceny. Zmiana cennika nie zmienia wysłanych ofert.
- Szkic (`ready`) przelicza się przy zmianie cennika tylko na życzenie („Odśwież ceny z cennika”).
- Po `sent` pozycje są tylko do odczytu w MVP (edycja = „Wyślij ponownie” po zmianie → nowe zdarzenie `edited` + `sent`; po `accepted` – zablokowane).
- Usunięcie konta: twarde usunięcie danych firmy, klientów i plików po 30 dniach (RODO).
