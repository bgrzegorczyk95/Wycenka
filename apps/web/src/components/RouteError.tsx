import { Link, useRouteError } from 'react-router';
import { Button } from './Button';

/** Shown instead of the router's developer error page (e.g. a screen could not be loaded without signal). */
export function RouteError() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : '';
  const offline = /dynamically imported module|Failed to fetch|Importing a module script failed/i.test(
    message,
  );
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="m-0 font-display text-[26px] font-bold">
        {offline ? 'Brak połączenia' : 'Coś poszło nie tak'}
      </h1>
      <p className="m-0 max-w-[360px] text-[15px] text-ink-2">
        {offline
          ? 'Nie udało się wczytać tego ekranu. Nagrania zapisane w telefonie nie przepadły – wyślemy je, gdy wróci zasięg.'
          : 'Odśwież stronę i spróbuj ponownie.'}
      </p>
      <Button variant="dark" onClick={() => window.location.reload()}>
        Spróbuj ponownie
      </Button>
      <Link to="/oferty" className="min-h-11 text-[15px] text-muted underline">
        Wróć do ofert
      </Link>
    </div>
  );
}
