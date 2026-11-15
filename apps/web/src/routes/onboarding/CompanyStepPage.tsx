import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { CompanyForm } from '../../components/CompanyForm';
import { OnboardingShell } from '../../components/OnboardingShell';
import { useMe } from '../../lib/session';

export function CompanyStepPage() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  if (!me) return null;

  return (
    <OnboardingShell
      step={3}
      wide
      eyebrow={
        <Link to="/start/stawki" className="text-muted">
          Krok 3 z 3
        </Link>
      }
      title="Dane firmy"
      description={
        <>
          Pojawią się na każdej ofercie.{' '}
          <span className="lg:hidden">Wszystko zmienisz później w ustawieniach.</span>
          <span className="hidden lg:inline">Po prawej widzisz, jak będzie wyglądał nagłówek.</span>
        </>
      }
    >
      <CompanyForm
        me={me}
        finishOnboarding
        withPreview
        onSaved={() => navigate('/oferty', { replace: true })}
        actions={(busy) => (
          <div className="sticky bottom-0 -mx-5 bg-bg px-5 pt-4 pb-7 lg:static lg:mx-0 lg:flex lg:items-center lg:justify-between lg:bg-transparent lg:p-0 lg:pt-2">
            <Link
              to="/start/stawki"
              className="hidden min-h-11 items-center text-[15px] text-ink-2 underline lg:flex"
            >
              Wróć do stawek
            </Link>
            <Button type="submit" size="main" disabled={busy} className="lg:w-auto lg:min-h-[52px] lg:px-6">
              <span className="lg:hidden">Gotowe – zrób pierwszą ofertę</span>
              <span className="hidden lg:inline">Gotowe – przejdź do ofert</span>
            </Button>
          </div>
        )}
      />
    </OnboardingShell>
  );
}
