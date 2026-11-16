import { Hono } from 'hono';
import { companyRoutes } from './api/company';
import { fileRoutes } from './api/files';
import { meRoutes } from './api/me';
import { offerRoutes } from './api/offers';
import { onboardingRoutes } from './api/onboarding';
import { priceListRoutes } from './api/priceList';
import { createAuth } from './auth';
import { clientPageRoutes } from './client-page/routes';
import { fail, type AppEnv } from './http';
import { requireSession } from './session';

export const app = new Hono<AppEnv>();

app.get('/api/health', (c) => c.json({ ok: true, service: 'wycenka' }));

// Better Auth: phone (SMS) and e-mail one-time codes, sessions in cookies.
app.on(['GET', 'POST'], '/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw));

for (const path of [
  '/api/me',
  '/api/onboarding',
  '/api/company',
  '/api/price-list',
  '/api/offers',
  '/api/files',
]) {
  app.use(path, requireSession);
  app.use(`${path}/*`, requireSession);
}

app.route('/api/me', meRoutes);
app.route('/api/onboarding', onboardingRoutes);
app.route('/api/company', companyRoutes);
app.route('/api/price-list', priceListRoutes);
app.route('/api/offers', offerRoutes);
app.route('/api/files', fileRoutes);

app.all('/api/*', (c) => fail(c, 404, 'not_found', 'Nie znaleziono.'));

// Client offer page (server-rendered, no login, works without JS).
app.route('/o', clientPageRoutes);

app.onError((err, c) => {
  // No request bodies or personal data in logs (RODO).
  console.error('unhandled_error', err.name, err.message);
  return fail(c, 500, 'internal', 'Coś poszło nie tak. Spróbuj ponownie za chwilę.');
});
