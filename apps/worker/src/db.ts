import * as schema from '@wycenka/db';
import { drizzle } from 'drizzle-orm/d1';
import type { Env } from './env';

export function getDb(env: Pick<Env, 'DB'>) {
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
