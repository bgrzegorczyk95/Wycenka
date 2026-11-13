import type { AiQuestion, RoomGeometry, Scope, Unit } from '@wycenka/core';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * D1 schema (docs/04-model-danych.md).
 * Conventions: text ids, times as integer ms since epoch (UTC), money as integer grosze (…Gr),
 * quantities as integer thousandths (qtyMilli), percentages as basis points (…Bps).
 * Every business table has companyId and an index on it.
 */

// ---------------------------------------------------------------------------
// Better Auth (core tables + phone number plugin + additional user fields).
// Property names must match Better Auth field names; the Drizzle adapter maps them.
// ---------------------------------------------------------------------------

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  phoneNumber: text('phone_number').unique(),
  phoneNumberVerified: integer('phone_number_verified', { mode: 'boolean' }),
  companyId: text('company_id'),
  role: text('role', { enum: ['owner', 'member'] })
    .notNull()
    .default('owner'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('session_user').on(t.userId)],
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('account_user').on(t.userId)],
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('verification_identifier').on(t.identifier)],
);

// ---------------------------------------------------------------------------
// Business tables
// ---------------------------------------------------------------------------

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(), // „Usługi Glazurnicze Nowak”; '' until onboarding step 3
  nip: text('nip'),
  phone: text('phone'),
  email: text('email'),
  serviceArea: text('service_area'), // „Warszawa i okolice”
  logoKey: text('logo_key'), // R2
  trades: text('trades', { mode: 'json' }).$type<string[]>().notNull(), // ['glazurnik']
  customTrade: text('custom_trade'), // „Inna profesja – opisz własnymi słowami”
  defaultValidityDays: integer('default_validity_days').notNull().default(14),
  defaultDepositBps: integer('default_deposit_bps').notNull().default(3000),
  defaultVatBps: integer('default_vat_bps').default(800), // 800 | 2300 | null = zwolniony
  plan: text('plan', { enum: ['free', 'pro', 'team'] })
    .notNull()
    .default('free'),
  planRenewsAt: integer('plan_renews_at'),
  offerCounterMonth: text('offer_counter_month'), // '2026-11'
  offerCounter: integer('offer_counter').notNull().default(0),
  /** Current onboarding step; null when finished. */
  onboardingStep: text('onboarding_step', { enum: ['profesja', 'stawki', 'firma'] }).default('profesja'),
  onboardedAt: integer('onboarded_at'), // set by „Gotowe – zrób pierwszą ofertę”
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const priceListItems = sqliteTable(
  'price_list_items',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    category: text('category').notNull(), // 'Przygotowanie' | 'Płytki' | 'Montaż' | …
    name: text('name').notNull(), // „Płytki 60×120 – ściany”
    offerName: text('offer_name'), // name on the offer when different
    unit: text('unit', { enum: ['m2', 'mb', 'szt', 'kpl', 'h'] })
      .$type<Unit>()
      .notNull(),
    priceGr: integer('price_gr').notNull(), // net
    measure: text('measure', {
      enum: ['walls', 'floor', 'walls_floor', 'ceiling', 'perimeter', 'count', 'manual'],
    })
      .$type<Scope>()
      .notNull(),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
    aliases: text('aliases', { mode: 'json' }).$type<string[]>().notNull().default([]),
    includesMaterial: integer('includes_material', { mode: 'boolean' }).notNull().default(false),
    source: text('source', { enum: ['template', 'manual', 'import', 'offer'] }).notNull(),
    sourceOfferId: text('source_offer_id'),
    templateKey: text('template_key'), // e.g. 'glazurnik.skucie_plytek'
    archivedAt: integer('archived_at'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('pli_company').on(t.companyId),
    uniqueIndex('pli_company_template').on(t.companyId, t.templateKey),
  ],
);

export const pricingRules = sqliteTable(
  'pricing_rules',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    kind: text('kind', {
      enum: ['mosaic_surcharge', 'height_surcharge', 'min_order', 'travel_fee', 'material_markup'],
    }).notNull(),
    label: text('label').notNull(),
    bps: integer('bps'),
    amountGr: integer('amount_gr'),
    thresholdMilli: integer('threshold_milli'),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [index('pr_company').on(t.companyId), uniqueIndex('pr_company_kind').on(t.companyId, t.kind)],
);

export const clients = sqliteTable(
  'clients',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    district: text('district'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('cl_company').on(t.companyId)],
);

export const offers = sqliteTable(
  'offers',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    clientId: text('client_id'),
    createdByUserId: text('created_by_user_id').notNull(),
    clientUuid: text('client_uuid').notNull(), // idempotency key from the phone
    number: text('number'), // '2026/11/014' – assigned on first send
    title: text('title').notNull(),
    status: text('status', {
      enum: ['draft', 'queued', 'processing', 'ready', 'sent', 'opened', 'accepted', 'rejected', 'expired'],
    }).notNull(),
    token: text('token'),
    material: text('material', { enum: ['client', 'contractor'] })
      .notNull()
      .default('client'),
    geometry: text('geometry', { mode: 'json' }).$type<RoomGeometry[]>(),
    validUntil: text('valid_until'), // '2026-11-27'
    depositBps: integer('deposit_bps'),
    startText: text('start_text'),
    notesForClient: text('notes_for_client'),
    discountBps: integer('discount_bps'),
    discountGr: integer('discount_gr'),
    vatBps: integer('vat_bps'), // null = zwolniony
    netGr: integer('net_gr'),
    vatGr: integer('vat_gr'),
    grossGr: integer('gross_gr'),
    missingPriceCount: integer('missing_price_count').notNull().default(0),
    sendChannel: text('send_channel', { enum: ['sms', 'whatsapp', 'email', 'link'] }),
    aiQuestions: text('ai_questions', { mode: 'json' }).$type<AiQuestion[]>(),
    aiAnswers: text('ai_answers', { mode: 'json' }).$type<Record<string, string>>(),
    aiExtraction: text('ai_extraction', { mode: 'json' }),
    promptVersion: text('prompt_version'),
    processingError: text('processing_error'),
    countedForPlanMonth: text('counted_for_plan_month'), // '2026-11'
    sentAt: integer('sent_at'),
    openedAt: integer('opened_at'),
    acceptedAt: integer('accepted_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('of_company_status').on(t.companyId, t.status),
    uniqueIndex('of_token').on(t.token),
    uniqueIndex('of_client_uuid').on(t.companyId, t.clientUuid),
  ],
);

export const offerItems = sqliteTable(
  'offer_items',
  {
    id: text('id').primaryKey(),
    offerId: text('offer_id').notNull(),
    companyId: text('company_id').notNull(),
    itemKey: text('item_key').notNull(), // stable key from the pricing engine
    priceListItemId: text('price_list_item_id'), // null = „Brak w cenniku”
    name: text('name').notNull(),
    unit: text('unit').$type<Unit>().notNull(),
    qtyMilli: integer('qty_milli').notNull(),
    unitPriceGr: integer('unit_price_gr'),
    surchargeBps: integer('surcharge_bps').notNull().default(0),
    valueGr: integer('value_gr'),
    scope: text('scope').$type<Scope>(),
    sourceKind: text('source_kind', { enum: ['transcript', 'ai_answer', 'manual', 'rule'] }).notNull(),
    sourceQuote: text('source_quote'),
    sourceQuestionId: text('source_question_id'),
    locked: integer('locked', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull(),
  },
  (t) => [index('oi_offer').on(t.offerId), index('oi_company').on(t.companyId)],
);

export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id').primaryKey(),
    offerId: text('offer_id').notNull(),
    companyId: text('company_id').notNull(),
    kind: text('kind', { enum: ['audio', 'photo'] }).notNull(),
    r2Key: text('r2_key').notNull(),
    mime: text('mime').notNull(),
    durationMs: integer('duration_ms'),
    caption: text('caption'),
    visibleToClient: integer('visible_to_client', { mode: 'boolean' }).notNull().default(false),
    transcript: text('transcript'),
    uploadedAt: integer('uploaded_at'),
    deletedAt: integer('deleted_at'),
  },
  (t) => [index('at_offer').on(t.offerId), index('at_company').on(t.companyId)],
);

export const offerEvents = sqliteTable(
  'offer_events',
  {
    id: text('id').primaryKey(),
    offerId: text('offer_id').notNull(),
    companyId: text('company_id').notNull(),
    type: text('type', {
      enum: [
        'created',
        'queued',
        'processing_started',
        'processed',
        'processing_failed',
        'edited',
        'sent',
        'opened',
        'question',
        'accepted',
        'rejected',
        'expired',
        'reminder',
      ],
    }).notNull(),
    channel: text('channel'),
    payload: text('payload', { mode: 'json' }),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('oe_offer').on(t.offerId), index('oe_company').on(t.companyId)],
);

export const reminders = sqliteTable(
  'reminders',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    offerId: text('offer_id').notNull(),
    kind: text('kind', { enum: ['no_response', 'client_question', 'accepted'] }).notNull(),
    dueAt: integer('due_at').notNull(),
    doneAt: integer('done_at'),
    snoozedUntil: integer('snoozed_until'),
  },
  (t) => [index('re_company_due').on(t.companyId, t.dueAt)],
);

export const priceListImports = sqliteTable(
  'price_list_imports',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    source: text('source', { enum: ['voice', 'photo', 'file'] }).notNull(),
    r2Key: text('r2_key').notNull(),
    status: text('status', { enum: ['queued', 'processing', 'ready', 'applied', 'failed'] }).notNull(),
    result: text('result', { mode: 'json' }),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('pli_imp_company').on(t.companyId)],
);

export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    endpoint: text('endpoint').notNull(),
    keys: text('keys', { mode: 'json' }).notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('ps_user').on(t.userId), uniqueIndex('ps_endpoint').on(t.endpoint)],
);

export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    provider: text('provider').notNull(),
    providerCustomerId: text('provider_customer_id'),
    providerSubscriptionId: text('provider_subscription_id'),
    interval: text('interval', { enum: ['month', 'year'] }).notNull(),
    status: text('status').notNull(),
    currentPeriodEnd: integer('current_period_end'),
  },
  (t) => [index('su_company').on(t.companyId)],
);

/** Better Auth rate limiting (storage: database). */
export const rateLimit = sqliteTable('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: integer('last_request').notNull(),
});

export const authSchema = { user, session, account, verification, rateLimit };
