import { describe, expect, it } from 'vitest';
import { app } from '../src/app';

describe('worker api', () => {
  it('GET /api/health returns ok', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: 'wycenka' });
  });

  it('unknown /api route returns a Polish JSON error', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: 'not_found', message: 'Nie znaleziono.' } });
  });
});
