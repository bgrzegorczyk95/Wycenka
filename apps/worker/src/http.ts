import type { ApiError } from '@wycenka/core';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';
import type { Db } from './db';
import type { Env } from './env';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
}

export interface AppEnv {
  Bindings: Env;
  Variables: { db: Db; user: SessionUser; companyId: string };
}

export function apiError(code: string, message: string): ApiError {
  return { error: { code, message } };
}

export function fail(c: Context, status: ContentfulStatusCode, code: string, message: string) {
  return c.json(apiError(code, message), status);
}

/** Parses a JSON body with a zod schema; on error returns a 400 with the first Polish message. */
export async function parseBody<S extends z.ZodType>(
  c: Context,
  schema: S,
): Promise<{ ok: true; data: z.output<S> } | { ok: false; response: Response }> {
  const raw = await c.req.json().catch(() => undefined);
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  const first = result.error.issues[0];
  const message = first && !first.message.startsWith('Invalid') ? first.message : 'Nieprawidłowe dane.';
  return {
    ok: false,
    response: c.json(
      {
        ...apiError('validation', message),
        fields: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      400,
    ),
  };
}
