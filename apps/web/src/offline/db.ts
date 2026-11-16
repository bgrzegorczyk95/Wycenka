import Dexie, { type EntityTable } from 'dexie';

/**
 * Offline storage of the visit (docs/03 „Offline i nagrania”): the draft, recordings and photos live in
 * IndexedDB until the server confirms them. Files are ArrayBuffers (Blob in IndexedDB is unreliable on
 * older iOS Safari).
 */

export interface LocalOffer {
  /** Idempotency key – also the offer's clientUuid on the server. */
  clientUuid: string;
  /** draft: being recorded; queued: waiting to be sent; failed: rejected by the server (needs a look). */
  status: 'draft' | 'queued' | 'failed';
  client: { name: string; phone: string; address: string };
  /** false = „Uzupełnij ręcznie” (no AI processing). */
  process: boolean;
  /** Server id after POST /api/offers succeeded. */
  offerId?: string;
  attempts: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

export interface LocalFile {
  /** fileId sent to the server (upload URL) – a retry overwrites the same object. */
  id: string;
  clientUuid: string;
  kind: 'audio' | 'photo';
  mime: string;
  data: ArrayBuffer;
  durationMs?: number;
  caption?: string;
  createdAt: number;
}

export class WycenkaDb extends Dexie {
  offers!: EntityTable<LocalOffer, 'clientUuid'>;
  files!: EntityTable<LocalFile, 'id'>;

  constructor(name = 'wycenka') {
    super(name);
    this.version(1).stores({
      offers: 'clientUuid, status, updatedAt',
      files: 'id, clientUuid, createdAt',
    });
  }
}

export const localDb = new WycenkaDb();
