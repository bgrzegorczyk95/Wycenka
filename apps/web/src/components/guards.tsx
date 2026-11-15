import { Navigate, Outlet, useLocation } from 'react-router';
import { homePath, ONBOARDING_STEPS, onboardingPath, useMe } from '../lib/session';

export function FullPageMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6 text-center text-[15px] text-muted">
      {children}
    </div>
  );
}

function useGuardState() {
  const { data: me, isPending, isError, refetch } = useMe();
  if (isPending) return { kind: 'loading' as const };
  if (isError)
    return {
      kind: 'error' as const,
      retry: () => void refetch(),
    };
  return { kind: 'ready' as const, me };
}

function Loading() {
  return <FullPageMessage>Wczytywanie…</FullPageMessage>;
}

function LoadError({ retry }: { retry: () => void }) {
  return (
    <FullPageMessage>
      <span>
        Brak połączenia z serwerem.{' '}
        <button type="button" onClick={retry} className="min-h-11 font-semibold text-ink underline">
          Spróbuj ponownie
        </button>
      </span>
    </FullPageMessage>
  );
}

/** App screens: logged in and onboarding finished. */
export function RequireApp() {
  const state = useGuardState();
  const location = useLocation();
  if (state.kind === 'loading') return <Loading />;
  if (state.kind === 'error') return <LoadError retry={state.retry} />;
  if (!state.me) return <Navigate to="/logowanie" replace state={{ from: location.pathname }} />;
  if (state.me.needsOnboarding) return <Navigate to={homePath(state.me)} replace />;
  return <Outlet />;
}

/** Onboarding steps: logged in, not finished, and not ahead of the saved step. */
export function RequireOnboarding() {
  const state = useGuardState();
  const location = useLocation();
  if (state.kind === 'loading') return <Loading />;
  if (state.kind === 'error') return <LoadError retry={state.retry} />;
  if (!state.me) return <Navigate to="/logowanie" replace />;
  if (!state.me.needsOnboarding) return <Navigate to="/oferty" replace />;

  const requested = location.pathname.split('/').at(-1) as (typeof ONBOARDING_STEPS)[number];
  const allowed = ONBOARDING_STEPS.indexOf(state.me.onboardingStep ?? 'profesja');
  if (ONBOARDING_STEPS.indexOf(requested) > allowed) {
    return <Navigate to={onboardingPath(state.me.onboardingStep)} replace />;
  }
  return <Outlet />;
}

/** Login page: logged-in users go where they belong. */
export function RedirectIfLoggedIn() {
  const state = useGuardState();
  if (state.kind === 'loading') return <Loading />;
  if (state.kind === 'ready' && state.me) return <Navigate to={homePath(state.me)} replace />;
  return <Outlet />;
}
