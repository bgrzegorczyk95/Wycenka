import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPlatformProxy } from 'wrangler';
import { app } from '../src/app';
import type { Env } from '../src/env';
import { devOutbox } from '../src/notify/outbox';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '../../../packages/db/migrations');

export const APP_URL = 'http://localhost:5173';

/** Local D1 + R2 (Miniflare, in memory) with all migrations applied. */
export async function createTestEnv() {
  mkdirSync(join(here, '../../web/dist'), { recursive: true });
  const proxy = await getPlatformProxy<Env>({
    configPath: join(here, '../wrangler.jsonc'),
    persist: false,
    envFiles: [],
  });
  for (const file of readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const statements = readFileSync(join(migrationsDir, file), 'utf8')
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s && !/^(--[^\n]*\n?)+$/.test(s));
    if (statements.length) await proxy.env.DB.batch(statements.map((s) => proxy.env.DB.prepare(s)));
  }
  const env: Env = {
    ...proxy.env,
    APP_URL,
    ENVIRONMENT: 'test',
    BETTER_AUTH_SECRET: 'test-secret-0123456789abcdef0123456789abcdef',
    AUTH_RATE_LIMIT: 'off',
  };
  return { env, dispose: () => proxy.dispose() };
}

/** Tiny HTTP client that keeps the session cookie, like a browser. */
export class Client {
  cookie = '';
  constructor(private env: Env) {}

  async request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const isRaw = body instanceof ArrayBuffer || body instanceof Uint8Array;
    const res = await app.request(
      `${APP_URL}${path}`,
      {
        method,
        headers: {
          Origin: APP_URL,
          ...(body !== undefined && !isRaw ? { 'Content-Type': 'application/json' } : {}),
          ...(this.cookie ? { Cookie: this.cookie } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : isRaw ? (body as BodyInit) : JSON.stringify(body),
      },
      this.env,
    );
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookie) {
      const [pair] = c.split(';');
      const [name] = pair!.split('=');
      const rest = this.cookie
        .split('; ')
        .filter((p) => p && !p.startsWith(`${name}=`))
        .join('; ');
      this.cookie = [rest, pair].filter(Boolean).join('; ');
    }
    return res;
  }

  async json<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; body: T }> {
    const res = await this.request(method, path, body);
    return { status: res.status, body: (await res.json()) as T };
  }

  /** Full phone login: send code → read it from the dev outbox → verify. */
  async loginByPhone(phone = '+48600000000') {
    const before = devOutbox.length;
    const sent = await this.request('POST', '/api/auth/phone-number/send-otp', { phoneNumber: phone });
    if (sent.status !== 200) throw new Error(`send-otp ${sent.status}: ${await sent.text()}`);
    const sms = devOutbox.slice(before).find((m) => m.channel === 'sms' && m.to === phone);
    const code = /(\d{6})/.exec(sms?.text ?? '')?.[1];
    if (!code) throw new Error('no code in outbox');
    const verified = await this.request('POST', '/api/auth/phone-number/verify', {
      phoneNumber: phone,
      code,
    });
    if (verified.status !== 200) throw new Error(`verify ${verified.status}: ${await verified.text()}`);
    return code;
  }
}
