import { attachments } from '@wycenka/db';
import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { fail, type AppEnv } from '../http';

/** Recordings and photos of the contractor's own offers (docs/06 „GET /api/files/:fileId”). */
export const fileRoutes = new Hono<AppEnv>().get('/:fileId', async (c) => {
  const { db, companyId } = c.var;
  const file = await db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.id, c.req.param('fileId')),
        eq(attachments.companyId, companyId),
        isNull(attachments.deletedAt),
      ),
    )
    .get();
  const object = file?.uploadedAt && c.env.FILES ? await c.env.FILES.get(file.r2Key) : null;
  if (!file || !object) return fail(c, 404, 'not_found', 'Nie ma takiego pliku.');
  return new Response(object.body, {
    headers: {
      'Content-Type': file.mime,
      'Content-Length': String(object.size),
      'Cache-Control': 'private, max-age=86400',
    },
  });
});
