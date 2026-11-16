import { localDb, type LocalFile, type LocalOffer, type WycenkaDb } from './db';

/**
 * Offline queue: offer → files → processing (docs/03):
 *   POST /api/offers (idempotent by clientUuid) → PUT /api/offers/:id/files/:fileId → POST /api/offers/:id/process.
 * Every step is safe to repeat, so a sync can stop anywhere (no signal, closed tab) and resume later.
 */

export interface SyncResult {
  /** Offers that reached the server and were removed from the phone. */
  sent: { clientUuid: string; offerId: string }[];
  /** Still waiting (no connection, server error). */
  pending: number;
  failed: number;
  /** The user is logged out – nothing can be sent until they log in. */
  unauthorized: boolean;
}

type Fetch = typeof fetch;

class Retryable extends Error {}
class Rejected extends Error {}
class Unauthorized extends Error {}

async function call(fetchFn: Fetch, url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetchFn(url, { credentials: 'same-origin', ...init });
  } catch {
    throw new Retryable('Brak połączenia.');
  }
  if (res.ok) return res;
  if (res.status === 401) throw new Unauthorized();
  if (res.status >= 500 || res.status === 429 || res.status === 408)
    throw new Retryable(`HTTP ${res.status}`);
  const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  const error = new Rejected(body?.error?.message ?? `HTTP ${res.status}`);
  (error as Rejected & { code?: string }).code = body?.error?.code;
  throw error;
}

async function syncOne(db: WycenkaDb, fetchFn: Fetch, offer: LocalOffer): Promise<string> {
  const files = await db.files.where('clientUuid').equals(offer.clientUuid).sortBy('createdAt');
  let offerId = offer.offerId;

  if (!offerId) {
    const res = await call(fetchFn, '/api/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientUuid: offer.clientUuid,
        client: offer.client,
        files: files.map((f) => ({
          fileId: f.id,
          kind: f.kind,
          mime: f.mime,
          durationMs: f.durationMs ?? null,
          caption: f.caption ?? null,
        })),
      }),
    });
    offerId = ((await res.json()) as { id: string }).id;
    await db.offers.update(offer.clientUuid, { offerId });
  }

  for (const file of files) {
    await call(fetchFn, `/api/offers/${offerId}/files/${file.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': file.mime },
      body: new Blob([file.data], { type: file.mime }),
    });
    // Removed from the phone only after the server confirmed the upload.
    await db.files.delete(file.id);
  }

  if (offer.process) {
    try {
      await call(fetchFn, `/api/offers/${offerId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
    } catch (e) {
      // Already processing/sent, or AI not available: the offer is on the server – finish it there.
      const code = (e as { code?: string }).code;
      if (
        !(e instanceof Rejected) ||
        !['processing', 'already_sent', 'ai_unavailable'].includes(code ?? '')
      ) {
        throw e;
      }
    }
  }

  await db.offers.delete(offer.clientUuid);
  return offerId;
}

let running: Promise<SyncResult> | null = null;

/** Sends everything that waits on the phone. Concurrent calls share one run. */
export function syncQueue(fetchFn: Fetch = fetch, db: WycenkaDb = localDb): Promise<SyncResult> {
  running ??= (async () => {
    const result: SyncResult = { sent: [], pending: 0, failed: 0, unauthorized: false };
    try {
      const queued = await db.offers.where('status').equals('queued').sortBy('createdAt');
      for (const offer of queued) {
        try {
          const offerId = await syncOne(db, fetchFn, offer);
          result.sent.push({ clientUuid: offer.clientUuid, offerId });
        } catch (e) {
          if (e instanceof Unauthorized) {
            result.unauthorized = true;
            break;
          }
          if (e instanceof Rejected) {
            await db.offers.update(offer.clientUuid, {
              status: 'failed',
              lastError: e.message,
              updatedAt: Date.now(),
            });
          } else {
            await db.offers.update(offer.clientUuid, { attempts: offer.attempts + 1, updatedAt: Date.now() });
          }
        }
      }
      result.pending = await db.offers.where('status').equals('queued').count();
      result.failed = await db.offers.where('status').equals('failed').count();
      return result;
    } finally {
      running = null;
    }
  })();
  return running;
}

// --- Draft (screen 2) ------------------------------------------------------------

export async function loadOrCreateDraft(db: WycenkaDb = localDb): Promise<LocalOffer> {
  const existing = await db.offers.where('status').equals('draft').reverse().sortBy('updatedAt');
  if (existing[0]) return existing[0];
  const now = Date.now();
  const draft: LocalOffer = {
    clientUuid: crypto.randomUUID(),
    status: 'draft',
    client: { name: '', phone: '', address: '' },
    process: true,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.offers.add(draft);
  return draft;
}

export async function updateDraftClient(
  clientUuid: string,
  client: LocalOffer['client'],
  db: WycenkaDb = localDb,
) {
  await db.offers.update(clientUuid, { client, updatedAt: Date.now() });
}

export async function addFile(
  file: Omit<LocalFile, 'createdAt'>,
  db: WycenkaDb = localDb,
): Promise<LocalFile> {
  const stored = { ...file, createdAt: Date.now() };
  await db.files.add(stored);
  return stored;
}

export async function updateFileCaption(id: string, caption: string, db: WycenkaDb = localDb) {
  await db.files.update(id, { caption });
}

export async function removeFile(id: string, db: WycenkaDb = localDb) {
  await db.files.delete(id);
}

export async function draftFiles(clientUuid: string, db: WycenkaDb = localDb): Promise<LocalFile[]> {
  return db.files.where('clientUuid').equals(clientUuid).sortBy('createdAt');
}

/** „Gotowe” – the draft becomes a queued offer (sent now or when the connection is back). */
export async function queueDraft(clientUuid: string, process: boolean, db: WycenkaDb = localDb) {
  await db.offers.update(clientUuid, { status: 'queued', process, updatedAt: Date.now() });
}

/** A failed offer (e.g. validation) goes back to the queue after the user fixed it or wants a retry. */
export async function retryFailed(db: WycenkaDb = localDb) {
  await db.offers.where('status').equals('failed').modify({ status: 'queued', lastError: undefined });
}

export async function discardOffer(clientUuid: string, db: WycenkaDb = localDb) {
  await db.transaction('rw', db.offers, db.files, async () => {
    await db.files.where('clientUuid').equals(clientUuid).delete();
    await db.offers.delete(clientUuid);
  });
}

export interface WaitingOffer extends LocalOffer {
  recordingMs: number;
  photos: number;
}

/** Offers waiting on the phone (screen 18 and the list of offers). */
export async function waitingOffers(db: WycenkaDb = localDb): Promise<WaitingOffer[]> {
  const offers = await db.offers.where('status').anyOf('queued', 'failed').sortBy('createdAt');
  return Promise.all(
    offers.map(async (o) => {
      const files = await db.files.where('clientUuid').equals(o.clientUuid).toArray();
      return {
        ...o,
        recordingMs: files.filter((f) => f.kind === 'audio').reduce((s, f) => s + (f.durationMs ?? 0), 0),
        photos: files.filter((f) => f.kind === 'photo').length,
      };
    }),
  );
}
