import * as schema from '@wycenka/db';
import { drizzle } from 'drizzle-orm/d1';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Env } from './env';

export function getDb(env: Pick<Env, 'DB'>) {
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;

/** Runs statements atomically in one D1 batch (no-op for an empty list). */
export async function runBatch(db: Db, statements: BatchItem<'sqlite'>[]): Promise<void> {
  if (statements.length === 0) return;
  await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
}
