import { companies, user as userTable } from '@wycenka/db';
import { eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { createAuth } from './auth';
import { getDb, type Db } from './db';
import { fail, type AppEnv } from './http';

/**
 * Requires a Better Auth session and resolves the user's company (created on first login).
 * Every business query must filter by `c.var.companyId`.
 */
export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) return fail(c, 401, 'unauthorized', 'Zaloguj się, żeby kontynuować.');

  const db = getDb(c.env);
  const u = session.user as typeof session.user & { companyId?: string | null; phoneNumber?: string | null };
  const companyId = u.companyId ?? (await ensureCompany(db, u.id));

  c.set('db', db);
  c.set('user', { id: u.id, name: u.name, email: u.email, phoneNumber: u.phoneNumber ?? null });
  c.set('companyId', companyId);
  await next();
});

/** MVP: 1 user = 1 company. Deterministic id makes concurrent first requests safe. */
async function ensureCompany(db: Db, userId: string): Promise<string> {
  const companyId = `co_${userId}`;
  const now = Date.now();
  await db.batch([
    db
      .insert(companies)
      .values({ id: companyId, name: '', trades: [], createdAt: now, updatedAt: now })
      .onConflictDoNothing(),
    db.update(userTable).set({ companyId, role: 'owner' }).where(eq(userTable.id, userId)),
  ]);
  return companyId;
}
