import type { OfferDetail } from '@wycenka/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Env } from '../src/env';
import { createTestEnv, onboardGlazier } from './setup';

let env: Env;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ env, dispose } = await createTestEnv());
});
afterAll(async () => dispose());

let seq = 500;
const glazier = () => onboardGlazier(env, `+48600000${seq++}`);

describe('recordings and photos (M4 upload)', () => {
  it('registers files, blocks processing until uploaded, stores them in R2 and serves them to the owner only', async () => {
    const client = await glazier();
    const audioId = crypto.randomUUID();
    const photoId = crypto.randomUUID();
    const created = await client.json<OfferDetail>('POST', '/api/offers', {
      clientUuid: crypto.randomUUID(),
      client: { name: 'Anna Kowalska' },
      files: [
        { fileId: audioId, kind: 'audio', mime: 'audio/webm;codecs=opus', durationMs: 42000 },
        { fileId: photoId, kind: 'photo', mime: 'image/jpeg', caption: 'Wanna' },
      ],
    });
    expect(created.status).toBe(201);
    expect(created.body.attachments).toEqual(
      expect.arrayContaining([
        {
          id: audioId,
          kind: 'audio',
          mime: 'audio/webm;codecs=opus',
          durationMs: 42000,
          caption: null,
          uploaded: false,
        },
        {
          id: photoId,
          kind: 'photo',
          mime: 'image/jpeg',
          durationMs: null,
          caption: 'Wanna',
          uploaded: false,
        },
      ]),
    );
    const id = created.body.id;

    // Nothing to process before the recording arrives
    const early = await client.json<{ error: { code: string } }>('POST', `/api/offers/${id}/process`, {});
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('files_pending');

    // Wrong type, unknown file
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    expect(
      (
        await client.request('PUT', `/api/offers/${id}/files/${audioId}`, bytes, {
          'Content-Type': 'image/png',
        })
      ).status,
    ).toBe(415);
    expect(
      (
        await client.request('PUT', `/api/offers/${id}/files/${crypto.randomUUID()}`, bytes, {
          'Content-Type': 'audio/webm',
        })
      ).status,
    ).toBe(404);

    // Upload (twice = idempotent retry)
    for (let i = 0; i < 2; i++) {
      expect(
        (
          await client.request('PUT', `/api/offers/${id}/files/${audioId}`, bytes, {
            'Content-Type': 'audio/webm',
          })
        ).status,
      ).toBe(200);
    }
    expect(
      (
        await client.request('PUT', `/api/offers/${id}/files/${photoId}`, bytes, {
          'Content-Type': 'image/jpeg',
        })
      ).status,
    ).toBe(200);

    const detail = (await client.json<OfferDetail>('GET', `/api/offers/${id}`)).body;
    expect(detail.attachments.every((a) => a.uploaded)).toBe(true);

    const audio = await client.request('GET', `/api/files/${audioId}`);
    expect(audio.status).toBe(200);
    expect(audio.headers.get('content-type')).toBe('audio/webm;codecs=opus');
    expect(new Uint8Array(await audio.arrayBuffer())).toEqual(bytes);

    // Another company cannot read or upload
    const other = await glazier();
    expect((await other.request('GET', `/api/files/${audioId}`)).status).toBe(404);
    expect(
      (
        await other.request('PUT', `/api/offers/${id}/files/${audioId}`, bytes, {
          'Content-Type': 'audio/webm',
        })
      ).status,
    ).toBe(404);

    // Now processing can start
    expect((await client.request('POST', `/api/offers/${id}/process`, {})).status).toBe(202);
  });

  it('enforces the limits: 10 photos, 5 minutes of recordings, matching types', async () => {
    const client = await glazier();
    const base = { clientUuid: crypto.randomUUID(), client: { name: 'Jan Nowak' } };
    const photos = Array.from({ length: 11 }, () => ({
      fileId: crypto.randomUUID(),
      kind: 'photo',
      mime: 'image/jpeg',
    }));
    const tooMany = await client.json<{ error: { message: string } }>('POST', '/api/offers', {
      ...base,
      files: photos,
    });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.message).toBe('Najwyżej 10 zdjęć na ofertę.');

    const tooLong = await client.json<{ error: { message: string } }>('POST', '/api/offers', {
      ...base,
      files: [
        { fileId: crypto.randomUUID(), kind: 'audio', mime: 'audio/mp4', durationMs: 200_000 },
        { fileId: crypto.randomUUID(), kind: 'audio', mime: 'audio/mp4', durationMs: 120_000 },
      ],
    });
    expect(tooLong.body.error.message).toBe('Nagrania mogą trwać łącznie najwyżej 5 minut.');

    const mismatch = await client.json('POST', '/api/offers', {
      ...base,
      files: [{ fileId: crypto.randomUUID(), kind: 'audio', mime: 'image/jpeg' }],
    });
    expect(mismatch.status).toBe(400);
  });
});
