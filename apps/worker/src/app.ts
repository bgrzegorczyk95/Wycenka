import { Hono } from 'hono';
import type { Env } from './env';

export interface ApiError {
  error: { code: string; message: string };
}

export const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => c.json({ ok: true, service: 'wycenka' }));

app.all('/api/*', (c) => c.json<ApiError>({ error: { code: 'not_found', message: 'Nie znaleziono.' } }, 404));

app.onError((err, c) => {
  // No request bodies or personal data in logs (RODO).
  console.error('unhandled_error', err.name, err.message);
  return c.json<ApiError>(
    { error: { code: 'internal', message: 'Coś poszło nie tak. Spróbuj ponownie za chwilę.' } },
    500,
  );
});
