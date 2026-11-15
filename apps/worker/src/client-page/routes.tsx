import { PLANS, isSentStatus, warsawDate, type OfferStatus } from '@wycenka/core';
import { companies, offerEvents, offers } from '@wycenka/db';
import { and, count, eq, gte } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { getDb, runBatch, type Db } from '../db';
import type { Env } from '../env';
import { computeOffer, type OfferRow } from '../offers/state';
import {
  AcceptedPage,
  Layout,
  NotFoundPage,
  OfferPage,
  QuestionPage,
  type ClientOfferView,
  type PageMode,
} from './views';

type CompanyRow = typeof companies.$inferSelect;
type ClientEnv = { Bindings: Env; Variables: { nonce: string } };

const TOKEN = /^[0-9A-Za-z]{16}$/;
const MAX_QUESTIONS_PER_DAY = 5;
/** Link preview bots (WhatsApp, Messenger, SMS apps) must not count as „otwarta”. */
const BOT_UA =
  /bot|crawler|spider|facebookexternalhit|whatsapp|telegram|slack|twitter|discord|preview|skype|google|bing/i;

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  return ((words[0]![0] ?? '') + (words.length > 1 ? (words.at(-1)![0] ?? '') : '')).toUpperCase();
}

export function isExpired(row: OfferRow, now = Date.now()): boolean {
  if (row.status === 'accepted') return false;
  if (row.status === 'expired' || row.status === 'rejected') return true;
  return row.validUntil !== null && row.validUntil < warsawDate(now);
}

export function buildView(row: OfferRow, company: CompanyRow): ClientOfferView {
  const plan = PLANS[company.plan];
  return {
    token: row.token!,
    number: row.number,
    title: row.title,
    status: row.status as OfferStatus,
    createdAt: row.createdAt,
    acceptedAt: row.acceptedAt,
    validUntil: row.validUntil,
    depositBps: row.depositBps,
    startText: row.startText,
    notesForClient: row.notesForClient,
    material: row.material,
    company: {
      name: company.name,
      phone: company.phone,
      serviceArea: company.serviceArea,
      initials: initials(company.name),
      // Logo on the offer is a Pro feature (docs/01 „Plany”).
      logoUrl: plan.logo && company.logoKey ? `/o/${row.token}/logo?v=${company.updatedAt}` : null,
    },
    showFooter: plan.footer,
    result: computeOffer(row),
  };
}

const describe = (v: ClientOfferView) =>
  [v.number ? `Oferta nr ${v.number}` : 'Oferta', v.company.name].join(' · ');

/** Renders the offer page – used for the client link and the contractor's preview / print version. */
export function renderOffer(
  c: Context,
  v: ClientOfferView,
  mode: PageMode,
  nonce: string,
  opts: { confirm?: boolean; notice?: string | undefined; expired?: boolean } = {},
) {
  const page = (
    <Layout
      title={`Oferta: ${v.title} – ${v.company.name}`}
      description={describe(v)}
      nonce={nonce}
      mode={mode}
      beaconUrl={mode === 'client' && v.status === 'sent' ? `/o/${v.token}/opened` : undefined}
    >
      {v.status === 'accepted' && mode === 'client' ? (
        <AcceptedPage v={v} />
      ) : (
        <OfferPage v={v} mode={mode} confirm={!!opts.confirm} notice={opts.notice} expired={!!opts.expired} />
      )}
    </Layout>
  );
  return c.html(`<!doctype html>${page.toString()}`);
}

/** `framable`: the contractor's preview is shown in an iframe of the app (same origin only). */
export function securityHeaders(c: Context, nonce: string, { framable = false } = {}) {
  c.header('X-Robots-Tag', 'noindex, nofollow');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('Cache-Control', 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header(
    'Content-Security-Policy',
    `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors ${framable ? "'self'" : "'none'"}`,
  );
}

export const newNonce = () => crypto.randomUUID().replaceAll('-', '');

async function loadPublic(db: Db, token: string) {
  if (!TOKEN.test(token)) return null;
  const row = await db.select().from(offers).where(eq(offers.token, token)).get();
  // Nothing reaches the client before the contractor clicks „Wyślij” (CLAUDE.md, rule 4).
  if (!row || !isSentStatus(row.status)) return null;
  const company = await db.select().from(companies).where(eq(companies.id, row.companyId)).get();
  if (!company) return null;
  return { row, company };
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function notFound(c: Context<ClientEnv>) {
  const page = (
    <Layout title="Nie znaleziono oferty" description="Wycenka" nonce={c.var.nonce} mode="client">
      <NotFoundPage />
    </Layout>
  );
  return c.html(`<!doctype html>${page.toString()}`, 404);
}

export const clientPageRoutes = new Hono<ClientEnv>()
  .use('*', async (c, next) => {
    const nonce = newNonce();
    c.set('nonce', nonce);
    await next();
    securityHeaders(c, nonce);
  })

  .get('/:token', async (c) => {
    const db = getDb(c.env);
    const found = await loadPublic(db, c.req.param('token'));
    if (!found) return notFound(c);
    const view = buildView(found.row, found.company);
    const print = c.req.query('print') === '1';
    return renderOffer(c, view, print ? 'print' : 'client', c.var.nonce, {
      confirm: c.req.query('potwierdz') === '1',
      notice: c.req.query('pytanie') === 'wyslane' ? 'Wysłano. Oferta pozostaje aktywna.' : undefined,
      expired: isExpired(found.row),
    });
  })

  .post('/:token/opened', async (c) => {
    const db = getDb(c.env);
    const found = await loadPublic(db, c.req.param('token'));
    const ua = c.req.header('user-agent') ?? '';
    if (!found || BOT_UA.test(ua) || found.row.status !== 'sent') return c.body(null, 204);
    const now = Date.now();
    const { row } = found;
    await runBatch(db, [
      db
        .update(offers)
        .set({ status: 'opened', openedAt: now, updatedAt: now })
        .where(and(eq(offers.id, row.id), eq(offers.status, 'sent'))),
      db.insert(offerEvents).values({
        id: crypto.randomUUID(),
        offerId: row.id,
        companyId: row.companyId,
        type: 'opened',
        createdAt: now,
      }),
    ]);
    return c.body(null, 204);
  })

  .post('/:token/accept', async (c) => {
    const db = getDb(c.env);
    const token = c.req.param('token');
    const found = await loadPublic(db, token);
    if (!found) return notFound(c);
    const { row } = found;
    if (row.status === 'accepted' || isExpired(row)) return c.redirect(`/o/${token}`, 303);

    const now = Date.now();
    const result = computeOffer(row);
    // Evidence of acceptance (docs/03): time, hashed IP, user agent, gross amount at that moment.
    const ip = c.req.header('cf-connecting-ip') ?? '';
    await runBatch(db, [
      db
        .update(offers)
        .set({ status: 'accepted', acceptedAt: now, updatedAt: now })
        .where(and(eq(offers.id, row.id), eq(offers.companyId, row.companyId))),
      db.insert(offerEvents).values({
        id: crypto.randomUUID(),
        offerId: row.id,
        companyId: row.companyId,
        type: 'accepted',
        payload: {
          grossGr: result.grossGr,
          number: row.number,
          ipHash: ip ? await sha256Hex(`${c.env.BETTER_AUTH_SECRET}:${ip}`) : null,
          userAgent: (c.req.header('user-agent') ?? '').slice(0, 300),
        },
        createdAt: now,
      }),
    ]);
    return c.redirect(`/o/${token}`, 303);
  })

  .get('/:token/pytanie', async (c) => {
    const db = getDb(c.env);
    const found = await loadPublic(db, c.req.param('token'));
    if (!found) return notFound(c);
    const view = buildView(found.row, found.company);
    const page = (
      <Layout title={`Pytanie: ${view.title}`} description={describe(view)} nonce={c.var.nonce} mode="client">
        <QuestionPage v={view} text={c.req.query('q') ?? ''} phone="" />
      </Layout>
    );
    return c.html(`<!doctype html>${page.toString()}`);
  })

  .post('/:token/pytanie', async (c) => {
    const db = getDb(c.env);
    const token = c.req.param('token');
    const found = await loadPublic(db, token);
    if (!found) return notFound(c);
    const form = await c.req.parseBody();
    const text = String(form.text ?? '').trim();
    const phone = String(form.phone ?? '')
      .trim()
      .slice(0, 30);
    // Honeypot: bots fill every field – pretend success.
    if (String(form.website ?? '') !== '') return c.redirect(`/o/${token}?pytanie=wyslane`, 303);

    const view = buildView(found.row, found.company);
    const again = (error: string) => {
      const page = (
        <Layout
          title={`Pytanie: ${view.title}`}
          description={describe(view)}
          nonce={c.var.nonce}
          mode="client"
        >
          <QuestionPage v={view} text={text} phone={phone} error={error} />
        </Layout>
      );
      return c.html(`<!doctype html>${page.toString()}`, 400);
    };
    if (text.length === 0) return again('Wpisz pytanie.');
    if (text.length > 1000) return again('Pytanie może mieć najwyżej 1000 znaków.');

    const since = Date.now() - 24 * 60 * 60 * 1000;
    const recent = await db
      .select({ n: count() })
      .from(offerEvents)
      .where(
        and(
          eq(offerEvents.offerId, found.row.id),
          eq(offerEvents.type, 'question'),
          gte(offerEvents.createdAt, since),
        ),
      )
      .get();
    if ((recent?.n ?? 0) >= MAX_QUESTIONS_PER_DAY) {
      return again('Wysłano już kilka pytań. Zadzwoń do wykonawcy albo spróbuj jutro.');
    }
    // A question does not change the status (docs/01) – it creates an event (and a reminder in M7).
    await db.insert(offerEvents).values({
      id: crypto.randomUUID(),
      offerId: found.row.id,
      companyId: found.row.companyId,
      type: 'question',
      payload: { text, phone: phone || null },
      createdAt: Date.now(),
    });
    return c.redirect(`/o/${token}?pytanie=wyslane`, 303);
  })

  /** PDF: Browser Rendering comes with M6 deploy (MOCK_PDF) – until then the print view („Zapisz jako PDF”). */
  .get('/:token/pdf', async (c) => c.redirect(`/o/${c.req.param('token')}?print=1`, 302))

  .get('/:token/logo', async (c) => {
    const db = getDb(c.env);
    const found = await loadPublic(db, c.req.param('token'));
    if (!found || !PLANS[found.company.plan].logo || !found.company.logoKey) return c.body(null, 404);
    const object = await c.env.FILES.get(found.company.logoKey);
    if (!object) return c.body(null, 404);
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType ?? 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  });
