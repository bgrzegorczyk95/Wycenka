import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WycenkaDb } from './db';
import {
  addFile,
  discardOffer,
  draftFiles,
  loadOrCreateDraft,
  queueDraft,
  retryFailed,
  syncQueue,
  updateDraftClient,
  waitingOffers,
} from './queue';

let db: WycenkaDb;
let n = 0;

beforeEach(async () => {
  db = new WycenkaDb(`test-${n++}`);
  await db.open();
});
afterEach(async () => {
  db.close();
});

/** Fake server: records calls; `fail` decides per call whether the network is down or the server refuses. */
function server(fail: (method: string, url: string, i: number) => 'network' | number | null = () => null) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const outcome = fail(method, url, calls.length);
    calls.push({
      method,
      url,
      body:
        typeof init?.body === 'string'
          ? JSON.parse(init.body)
          : init?.body instanceof Blob
            ? init.body.size
            : null,
    });
    if (outcome === 'network') throw new TypeError('Failed to fetch');
    if (typeof outcome === 'number') {
      return new Response(
        JSON.stringify({ error: { code: 'validation', message: 'Wpisz imię i nazwisko klienta.' } }),
        {
          status: outcome,
        },
      );
    }
    if (url === '/api/offers') return Response.json({ id: 'offer-1' }, { status: 201 });
    if (url.endsWith('/process'))
      return Response.json({ id: 'offer-1', status: 'processing' }, { status: 202 });
    return Response.json({ uploaded: true });
  }) as typeof fetch;
  return { fetchFn, calls };
}

async function draftWithFiles() {
  const draft = await loadOrCreateDraft(db);
  await updateDraftClient(draft.clientUuid, { name: 'Anna Kowalska', phone: '', address: 'Mokotów' }, db);
  await addFile(
    {
      id: 'audio-1',
      clientUuid: draft.clientUuid,
      kind: 'audio',
      mime: 'audio/webm',
      data: new ArrayBuffer(100),
      durationMs: 42000,
    },
    db,
  );
  await addFile(
    {
      id: 'photo-1',
      clientUuid: draft.clientUuid,
      kind: 'photo',
      mime: 'image/jpeg',
      data: new ArrayBuffer(50),
      caption: 'Wanna',
    },
    db,
  );
  return draft;
}

describe('offline queue', () => {
  it('keeps one draft across reopening the screen (nothing lost when the tab closes)', async () => {
    const a = await draftWithFiles();
    const b = await loadOrCreateDraft(db);
    expect(b.clientUuid).toBe(a.clientUuid);
    expect(b.client.name).toBe('Anna Kowalska');
    expect((await draftFiles(a.clientUuid, db)).map((f) => f.id)).toEqual(['audio-1', 'photo-1']);
  });

  it('drafts are not sent; queued offers are: create → upload files → process, then removed from the phone', async () => {
    const draft = await draftWithFiles();
    const idle = server();
    expect((await syncQueue(idle.fetchFn, db)).sent).toEqual([]);
    expect(idle.calls).toEqual([]);

    await queueDraft(draft.clientUuid, true, db);
    expect(await waitingOffers(db)).toEqual([
      expect.objectContaining({ clientUuid: draft.clientUuid, recordingMs: 42000, photos: 1 }),
    ]);

    const { fetchFn, calls } = server();
    const result = await syncQueue(fetchFn, db);
    expect(result).toEqual({
      sent: [{ clientUuid: draft.clientUuid, offerId: 'offer-1' }],
      pending: 0,
      failed: 0,
      unauthorized: false,
    });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST /api/offers',
      'PUT /api/offers/offer-1/files/audio-1',
      'PUT /api/offers/offer-1/files/photo-1',
      'POST /api/offers/offer-1/process',
    ]);
    expect(calls[0]!.body).toMatchObject({
      clientUuid: draft.clientUuid,
      client: { name: 'Anna Kowalska' },
      files: [
        { fileId: 'audio-1', kind: 'audio', durationMs: 42000 },
        { fileId: 'photo-1', kind: 'photo', caption: 'Wanna' },
      ],
    });
    expect(await db.offers.count()).toBe(0);
    expect(await db.files.count()).toBe(0);
  });

  it('no signal mid-way: keeps what is left and resumes without creating the offer again', async () => {
    const draft = await draftWithFiles();
    await queueDraft(draft.clientUuid, true, db);

    // Network drops on the second upload
    const first = server((method, url) => (url.endsWith('photo-1') ? 'network' : null));
    const r1 = await syncQueue(first.fetchFn, db);
    expect(r1).toMatchObject({ sent: [], pending: 1 });
    expect((await db.files.toArray()).map((f) => f.id)).toEqual(['photo-1']); // audio confirmed → removed
    expect((await db.offers.get(draft.clientUuid))!.offerId).toBe('offer-1');

    const second = server();
    const r2 = await syncQueue(second.fetchFn, db);
    expect(r2.sent).toHaveLength(1);
    expect(second.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'PUT /api/offers/offer-1/files/photo-1',
      'POST /api/offers/offer-1/process',
    ]);
  });

  it('server errors (5xx) are retried later; a refusal (4xx) marks the offer as failed', async () => {
    const draft = await draftWithFiles();
    await queueDraft(draft.clientUuid, true, db);
    expect(await syncQueue(server(() => 503).fetchFn, db)).toMatchObject({ pending: 1, failed: 0 });
    expect((await db.offers.get(draft.clientUuid))!.attempts).toBe(1);

    expect(await syncQueue(server(() => 400).fetchFn, db)).toMatchObject({ pending: 0, failed: 1 });
    expect(await db.offers.get(draft.clientUuid)).toMatchObject({
      status: 'failed',
      lastError: 'Wpisz imię i nazwisko klienta.',
    });
    expect(await db.files.count()).toBe(2); // nothing lost

    await retryFailed(db);
    expect((await syncQueue(server().fetchFn, db)).sent).toHaveLength(1);
  });

  it('logged out: stops and keeps everything', async () => {
    const draft = await draftWithFiles();
    await queueDraft(draft.clientUuid, true, db);
    expect(await syncQueue(server(() => 401).fetchFn, db)).toMatchObject({ unauthorized: true, pending: 1 });
    expect(await db.offers.get(draft.clientUuid)).toMatchObject({ status: 'queued' });
  });

  it('manual offers („Uzupełnij ręcznie”) skip processing; AI unavailable still counts as sent', async () => {
    const manual = await draftWithFiles();
    await queueDraft(manual.clientUuid, false, db);
    const { fetchFn, calls } = server();
    await syncQueue(fetchFn, db);
    expect(calls.some((c) => c.url.endsWith('/process'))).toBe(false);

    const withAi = await draftWithFiles();
    await queueDraft(withAi.clientUuid, true, db);
    const ok = server();
    const aiOff = (async (url: string, init?: RequestInit) =>
      url.endsWith('/process')
        ? new Response(JSON.stringify({ error: { code: 'ai_unavailable', message: 'x' } }), { status: 400 })
        : ok.fetchFn(url, init)) as typeof fetch;
    expect((await syncQueue(aiOff, db)).sent).toHaveLength(1);
  });

  it('concurrent syncs share one run (no double uploads)', async () => {
    const draft = await draftWithFiles();
    await queueDraft(draft.clientUuid, true, db);
    const { fetchFn, calls } = server();
    const [a, b] = await Promise.all([syncQueue(fetchFn, db), syncQueue(fetchFn, db)]);
    expect(a).toBe(b);
    expect(calls.filter((c) => c.method === 'POST' && c.url === '/api/offers')).toHaveLength(1);
  });

  it('discarding removes the offer and its files', async () => {
    const draft = await draftWithFiles();
    await discardOffer(draft.clientUuid, db);
    expect(await db.offers.count()).toBe(0);
    expect(await db.files.count()).toBe(0);
  });
});
