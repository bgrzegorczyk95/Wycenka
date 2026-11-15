import type { ApiError } from '@wycenka/core';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}

const NETWORK_MESSAGE = 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.';
const GENERIC_MESSAGE = 'Coś poszło nie tak. Spróbuj ponownie za chwilę.';

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Raw body (e.g. an image) sent with its own content type. */
  raw?: Blob;
}

/** JSON API client for /api/*. Errors are thrown as ApiRequestError with a Polish message. */
export async function api<T>(path: string, { method = 'GET', body, raw }: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: raw
        ? { 'Content-Type': raw.type }
        : body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {},
      body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiRequestError(0, 'network', NETWORK_MESSAGE);
  }
  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const err = (json as (ApiError & { fields?: ApiRequestError['fields'] }) | null)?.error;
    throw new ApiRequestError(
      res.status,
      err?.code ?? 'http_error',
      err?.message ?? GENERIC_MESSAGE,
      (json as { fields?: ApiRequestError['fields'] } | null)?.fields,
    );
  }
  return json as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : GENERIC_MESSAGE;
}
