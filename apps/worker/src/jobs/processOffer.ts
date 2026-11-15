import { offerEvents, offers } from '@wycenka/db';
import { and, eq } from 'drizzle-orm';
import { MOCK_RECORDING_MS, MOCK_TRANSCRIPT, mockExtraction } from '../ai/mock';
import { getDb, runBatch } from '../db';
import type { Env } from '../env';
import { DEFAULT_OFFER_TITLE, computeOffer, persistResult, takeSnapshot } from '../offers/state';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Queue job `process-offer` (docs/03 „Przetwarzanie oferty”):
 * transcription → extraction (structure only) → pricing engine → status ready.
 * Until M5 only MOCK_AI is implemented; `stepDelayMs` makes the progress screen visible in dev.
 */
export async function processOffer(env: Env, offerId: string, stepDelayMs = 0): Promise<void> {
  const db = getDb(env);
  const row = await db.select().from(offers).where(eq(offers.id, offerId)).get();
  if (!row || row.status !== 'processing') return;
  const where = and(eq(offers.id, row.id), eq(offers.companyId, row.companyId));

  try {
    if (env.MOCK_AI !== '1') throw new Error('AI provider not configured');

    // 1. Speech to text
    await sleep(stepDelayMs);
    await db
      .update(offers)
      .set({ processingStep: 'transcribed', transcript: MOCK_TRANSCRIPT, recordingMs: MOCK_RECORDING_MS })
      .where(where);

    // 2. Extraction against the contractor's price list (snapshot = prices used for this offer)
    await sleep(stepDelayMs);
    const snapshot = await takeSnapshot(db, row.companyId);
    const extraction = mockExtraction(snapshot.priceList, row.aiAnswers ?? {});
    // A title typed by the contractor wins over the AI one.
    const title = row.title === DEFAULT_OFFER_TITLE && extraction.title ? extraction.title : row.title;
    const material = extraction.material === 'contractor' ? ('contractor' as const) : ('client' as const);
    await db
      .update(offers)
      .set({
        processingStep: 'matched',
        priceSnapshot: snapshot,
        aiExtraction: extraction,
        title,
        material,
        promptVersion: 'mock-1',
      })
      .where(where);

    // 3. Pricing (deterministic code)
    await sleep(stepDelayMs);
    const now = Date.now();
    const updated = {
      ...row,
      title,
      transcript: MOCK_TRANSCRIPT,
      priceSnapshot: snapshot,
      aiExtraction: extraction,
      material,
    };
    const result = computeOffer(updated);
    await runBatch(db, [
      ...persistResult(db, updated, result, now),
      db
        .update(offers)
        .set({ status: 'ready', processingStep: 'priced', processingError: null })
        .where(where),
      db.insert(offerEvents).values({
        id: crypto.randomUUID(),
        offerId: row.id,
        companyId: row.companyId,
        type: 'processed',
        payload: { promptVersion: 'mock-1' },
        createdAt: now,
      }),
    ]);
  } catch (e) {
    // No transcript or client data in logs (RODO).
    console.error('process_offer_failed', offerId, e instanceof Error ? e.message : 'unknown');
    await db.batch([
      db
        .update(offers)
        .set({ status: 'draft', processingError: 'Nie udało się przygotować oferty.', updatedAt: Date.now() })
        .where(where),
      db.insert(offerEvents).values({
        id: crypto.randomUUID(),
        offerId: row.id,
        companyId: row.companyId,
        type: 'processing_failed',
        createdAt: Date.now(),
      }),
    ]);
  }
}
