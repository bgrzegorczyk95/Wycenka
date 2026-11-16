import {
  priceOffer,
  type Extraction,
  type OfferDetail,
  type OfferEvent,
  type OfferListItem,
  type PriceOfferResult,
} from '@wycenka/core';
import {
  attachments,
  clients,
  offerEvents,
  offerItems,
  offers,
  priceListItems,
  pricingRules,
  type PriceSnapshot,
} from '@wycenka/db';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Db } from '../db';

export type OfferRow = typeof offers.$inferSelect;
type ClientRow = typeof clients.$inferSelect;

/** Title until the contractor or the AI gives a better one. */
export const DEFAULT_OFFER_TITLE = 'Nowa oferta';

export function emptyExtraction(title: string): Extraction {
  return { title, rooms: [], items: [], material: 'client', outOfTown: null, questions: [] };
}

/** Price list and rules as they are now – stored with the offer at pricing time. */
export async function takeSnapshot(db: Db, companyId: string): Promise<PriceSnapshot> {
  const items = await db
    .select()
    .from(priceListItems)
    .where(and(eq(priceListItems.companyId, companyId), isNull(priceListItems.archivedAt)))
    .orderBy(asc(priceListItems.sortOrder), asc(priceListItems.createdAt))
    .all();
  const rules = await db.select().from(pricingRules).where(eq(pricingRules.companyId, companyId)).all();
  return {
    priceList: items.map((i) => ({
      id: i.id,
      name: i.name,
      offerName: i.offerName,
      unit: i.unit,
      measure: i.measure,
      priceGr: i.priceGr,
      tags: i.tags,
      aliases: i.aliases,
      category: i.category,
      templateKey: i.templateKey,
    })),
    rules: rules.map((r) => ({
      kind: r.kind,
      label: r.label,
      bps: r.bps,
      amountGr: r.amountGr,
      thresholdMilli: r.thresholdMilli,
      enabled: r.enabled,
    })),
    takenAt: Date.now(),
  };
}

/** Runs the deterministic pricing engine on the stored offer state. */
export function computeOffer(row: OfferRow): PriceOfferResult {
  const extraction = row.aiExtraction ?? emptyExtraction(row.title);
  const discount =
    row.discountBps || row.discountGr
      ? {
          ...(row.discountBps ? { bps: row.discountBps } : {}),
          ...(row.discountGr ? { gr: row.discountGr } : {}),
        }
      : null;
  return priceOffer({
    extraction: { ...extraction, material: row.material },
    answers: row.aiAnswers ?? {},
    priceList: row.priceSnapshot?.priceList ?? [],
    rules: row.priceSnapshot?.rules ?? [],
    overrides: row.overrides,
    vatBps: row.vatBps,
    discount,
    ...(row.transcript ? { transcript: row.transcript } : {}),
  });
}

/** Statements that store the engine output (items + totals) for lists, the client page and history. */
export function persistResult(
  db: Db,
  row: OfferRow,
  result: PriceOfferResult,
  now: number,
): BatchItem<'sqlite'>[] {
  const statements: BatchItem<'sqlite'>[] = [db.delete(offerItems).where(eq(offerItems.offerId, row.id))];
  const rows = result.items.map((item, sortOrder) => ({
    id: crypto.randomUUID(),
    offerId: row.id,
    companyId: row.companyId,
    itemKey: item.key,
    priceListItemId: item.priceListItemId,
    name: item.name,
    unit: item.unit,
    qtyMilli: item.qtyMilli,
    unitPriceGr: item.unitPriceGr,
    surchargeBps: item.surchargeBps,
    valueGr: item.valueGr,
    scope: item.scope,
    sourceKind: item.sourceKind,
    sourceQuote: item.sourceQuote,
    sourceQuestionId: item.sourceQuestionId,
    locked: item.locked,
    sortOrder,
  }));
  // D1 limits bound parameters per statement.
  for (let i = 0; i < rows.length; i += 5)
    statements.push(db.insert(offerItems).values(rows.slice(i, i + 5)));
  statements.push(
    db
      .update(offers)
      .set({
        geometry: result.geometry,
        aiQuestions: result.questions.map(({ answer: _a, ...q }) => q),
        netGr: result.netGr,
        vatGr: result.vatGr,
        grossGr: result.grossGr,
        missingPriceCount: result.missingPriceCount,
        updatedAt: now,
      })
      .where(and(eq(offers.id, row.id), eq(offers.companyId, row.companyId))),
  );
  return statements;
}

export async function loadOffer(db: Db, companyId: string, id: string): Promise<OfferRow | undefined> {
  return db
    .select()
    .from(offers)
    .where(and(eq(offers.id, id), eq(offers.companyId, companyId)))
    .get();
}

export async function loadClient(db: Db, row: OfferRow): Promise<ClientRow | undefined> {
  if (!row.clientId) return undefined;
  return db
    .select()
    .from(clients)
    .where(and(eq(clients.id, row.clientId), eq(clients.companyId, row.companyId)))
    .get();
}

export function offerLink(appUrl: string, token: string | null): string {
  return `${appUrl.replace(/\/$/, '')}/o/${token ?? ''}`;
}

/** R2 key of a recording/photo – scoped by company and offer. */
export function fileKey(companyId: string, offerId: string, fileId: string): string {
  return `offers/${companyId}/${offerId}/${fileId}`;
}

export async function loadAttachments(db: Db, row: Pick<OfferRow, 'id' | 'companyId'>) {
  return db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.offerId, row.id),
        eq(attachments.companyId, row.companyId),
        isNull(attachments.deletedAt),
      ),
    )
    .orderBy(asc(attachments.id))
    .all();
}

export async function toDetail(db: Db, row: OfferRow, appUrl: string): Promise<OfferDetail> {
  const result = computeOffer(row);
  const client = await loadClient(db, row);
  const events = await db
    .select()
    .from(offerEvents)
    .where(and(eq(offerEvents.offerId, row.id), eq(offerEvents.companyId, row.companyId)))
    .orderBy(asc(offerEvents.createdAt))
    .all();
  const files = await loadAttachments(db, row);
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    status: row.status,
    link: offerLink(appUrl, row.token),
    client: client
      ? { name: client.name, phone: client.phone, email: client.email, address: client.address }
      : null,
    material: row.material,
    validUntil: row.validUntil,
    depositBps: row.depositBps,
    startText: row.startText,
    notesForClient: row.notesForClient,
    vatBps: row.vatBps,
    discountBps: row.discountBps,
    discountGr: row.discountGr,
    transcript: row.transcript,
    recordingMs: row.recordingMs,
    processingStep: row.processingStep,
    processingError: row.processingError,
    geometry: result.geometry,
    items: result.items,
    questions: result.questions,
    warnings: result.warnings,
    totals: {
      itemsSubtotalGr: result.itemsSubtotalGr,
      discountGr: result.discountGr,
      netGr: result.netGr,
      vatBps: result.vatBps,
      vatGr: result.vatGr,
      grossGr: result.grossGr,
      missingPriceCount: result.missingPriceCount,
      canSend: result.canSend,
    },
    sendChannel: row.sendChannel,
    sentAt: row.sentAt,
    openedAt: row.openedAt,
    acceptedAt: row.acceptedAt,
    createdAt: row.createdAt,
    events: events.map((e): OfferEvent => ({
      type: e.type,
      channel: e.channel,
      createdAt: e.createdAt,
      // Client data (question text, IP hash) is shown only where needed.
      payload: e.type === 'question' ? (e.payload as Record<string, unknown>) : null,
    })),
    attachments: files.map((f) => ({
      id: f.id,
      kind: f.kind,
      mime: f.mime,
      durationMs: f.durationMs,
      caption: f.caption,
      uploaded: f.uploadedAt !== null,
    })),
  };
}

export function toListItem(row: OfferRow, client: ClientRow | null): OfferListItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    clientName: client?.name ?? null,
    clientAddress: client?.district ?? client?.address ?? null,
    grossGr: row.grossGr && row.grossGr > 0 ? row.grossGr : null,
    missingPriceCount: row.missingPriceCount,
    updatedAt: row.updatedAt,
  };
}

/** 16 characters base62 from crypto.getRandomValues (docs/03). */
export function newToken(length = 16): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let out = '';
  while (out.length < length) {
    // Rejection sampling: bytes ≥ 248 (= 4 × 62) would bias the distribution.
    for (const b of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (b < 248 && out.length < length) out += alphabet[b % 62];
    }
  }
  return out;
}
