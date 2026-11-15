import { CompanyInput, LOGO_MAX_BYTES, LOGO_TYPES } from '@wycenka/core';
import { companies, user as userTable } from '@wycenka/db';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { fail, parseBody, type AppEnv } from '../http';
import { buildMe, getCompanyRow } from './me';

const logoKey = (companyId: string) => `logos/${companyId}`;

export const companyRoutes = new Hono<AppEnv>()
  .patch('/', async (c) => {
    const parsed = await parseBody(c, CompanyInput);
    if (!parsed.ok) return parsed.response;
    const { ownerName, finishOnboarding, ...data } = parsed.data;
    const { db, companyId, user } = c.var;
    const now = Date.now();

    await db.batch([
      db
        .update(companies)
        .set({
          ...data,
          updatedAt: now,
          ...(finishOnboarding ? { onboardingStep: null, onboardedAt: now } : {}),
        })
        .where(eq(companies.id, companyId)),
      db
        .update(userTable)
        .set({ name: ownerName, updatedAt: new Date(now) })
        .where(eq(userTable.id, user.id)),
    ]);
    return c.json(await buildMe(db, { ...user, name: ownerName }, companyId, c.env));
  })

  .put('/logo', async (c) => {
    const type = (c.req.header('content-type') ?? '').split(';')[0]!.trim();
    if (!(LOGO_TYPES as readonly string[]).includes(type)) {
      return fail(c, 415, 'logo_type', 'Logo musi być plikiem PNG albo JPG.');
    }
    const declared = Number(c.req.header('content-length') ?? 0);
    if (declared > LOGO_MAX_BYTES) return fail(c, 413, 'logo_size', 'Logo może mieć najwyżej 2 MB.');
    const body = await c.req.arrayBuffer();
    if (body.byteLength === 0) return fail(c, 400, 'logo_empty', 'Wybierz plik z logo.');
    if (body.byteLength > LOGO_MAX_BYTES) return fail(c, 413, 'logo_size', 'Logo może mieć najwyżej 2 MB.');

    const { db, companyId, user } = c.var;
    if (!c.env.FILES) return fail(c, 503, 'files_unavailable', 'Wgrywanie logo będzie dostępne wkrótce.');
    await c.env.FILES.put(logoKey(companyId), body, { httpMetadata: { contentType: type } });
    await db
      .update(companies)
      .set({ logoKey: logoKey(companyId), updatedAt: Date.now() })
      .where(eq(companies.id, companyId));
    return c.json(await buildMe(db, user, companyId, c.env));
  })

  .get('/logo', async (c) => {
    const company = await getCompanyRow(c.var.db, c.var.companyId);
    const object = company.logoKey && c.env.FILES ? await c.env.FILES.get(company.logoKey) : null;
    if (!object) return fail(c, 404, 'not_found', 'Brak logo.');
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
        // URLs carry ?v=<logoVersion>, so the image can be cached.
        'Cache-Control': 'private, max-age=86400',
      },
    });
  })

  .delete('/logo', async (c) => {
    const { db, companyId, user } = c.var;
    await c.env.FILES?.delete(logoKey(companyId));
    await db
      .update(companies)
      .set({ logoKey: null, updatedAt: Date.now() })
      .where(eq(companies.id, companyId));
    return c.json(await buildMe(db, user, companyId, c.env));
  });
