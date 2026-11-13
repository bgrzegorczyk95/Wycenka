import { createBrowserRouter, Navigate } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { CompanyPage } from './routes/CompanyPage';
import { NotFoundPage } from './routes/NotFoundPage';
import { OffersPage } from './routes/OffersPage';
import { PriceListPage } from './routes/PriceListPage';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      // Landing page (`/`) and login arrive in M2.
      { index: true, element: <Navigate to="/oferty" replace /> },
      { path: 'oferty', element: <OffersPage /> },
      { path: 'cennik', element: <PriceListPage /> },
      { path: 'firma', element: <CompanyPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
