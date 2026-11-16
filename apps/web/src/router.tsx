import { createBrowserRouter, Navigate } from 'react-router';
import { RedirectIfLoggedIn, RequireApp, RequireOnboarding } from './components/guards';
import { RouteError } from './components/RouteError';
import { LandingPage } from './routes/LandingPage';
import { LegalPage } from './routes/LegalPage';
import { LoginPage } from './routes/LoginPage';

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/regulamin', element: <LegalPage title="Regulamin" /> },
  { path: '/polityka-prywatnosci', element: <LegalPage title="Polityka prywatności" /> },
  {
    element: <RedirectIfLoggedIn />,
    children: [{ path: '/logowanie', element: <LoginPage /> }],
  },
  {
    path: '/start',
    element: <RequireOnboarding />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="profesja" replace /> },
      {
        path: 'profesja',
        lazy: () =>
          import('./routes/onboarding/ProfessionPage').then((m) => ({ Component: m.ProfessionPage })),
      },
      {
        path: 'stawki',
        lazy: () => import('./routes/onboarding/RatesPage').then((m) => ({ Component: m.RatesPage })),
      },
      {
        path: 'firma',
        lazy: () =>
          import('./routes/onboarding/CompanyStepPage').then((m) => ({ Component: m.CompanyStepPage })),
      },
    ],
  },
  {
    element: <RequireApp />,
    errorElement: <RouteError />,
    children: [
      {
        lazy: () => import('./components/AppLayout').then((m) => ({ Component: m.AppLayout })),
        children: [
          {
            path: '/oferty',
            lazy: () => import('./routes/OffersPage').then((m) => ({ Component: m.OffersPage })),
          },
          {
            path: '/oferty/nowa',
            lazy: () => import('./routes/offers/NewOfferPage').then((m) => ({ Component: m.NewOfferPage })),
          },
          {
            path: '/oferty/oczekujace',
            lazy: () => import('./routes/offers/PendingPage').then((m) => ({ Component: m.PendingPage })),
          },
          {
            path: '/oferty/:id',
            lazy: () => import('./routes/offers/OfferPage').then((m) => ({ Component: m.OfferPage })),
          },
          {
            path: '/oferty/:id/wysylka',
            lazy: () => import('./routes/offers/SendPage').then((m) => ({ Component: m.SendPage })),
          },
          {
            path: '/cennik',
            lazy: () => import('./routes/PriceListPage').then((m) => ({ Component: m.PriceListPage })),
          },
          {
            path: '/cennik/branza',
            lazy: () =>
              import('./routes/priceList/AddTradePage').then((m) => ({ Component: m.ChooseTradePage })),
          },
          {
            path: '/cennik/branza/:trade',
            lazy: () =>
              import('./routes/priceList/AddTradePage').then((m) => ({ Component: m.AddTradeRatesPage })),
          },
          {
            path: '/firma',
            lazy: () => import('./routes/CompanyPage').then((m) => ({ Component: m.CompanyPage })),
          },
          {
            path: '*',
            lazy: () => import('./routes/NotFoundPage').then((m) => ({ Component: m.NotFoundPage })),
          },
        ],
      },
    ],
  },
]);
