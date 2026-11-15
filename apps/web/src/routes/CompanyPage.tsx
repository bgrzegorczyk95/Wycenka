import { formatPlPhone } from '@wycenka/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { CompanyForm } from '../components/CompanyForm';
import { Notice } from '../components/fields';
import { PageHeader } from '../components/PageHeader';
import { errorMessage } from '../lib/api';
import { signOut } from '../lib/auth';
import { ME_KEY, useMe } from '../lib/session';

/** „Firma i logo” – the same form as onboarding step 3 (docs/02, ekran 16/23). */
export function CompanyPage() {
  const { data: me } = useMe();
  const [saved, setSaved] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  if (!me) return null;

  async function logout() {
    try {
      await signOut();
      queryClient.setQueryData(ME_KEY, null);
      queryClient.clear();
      navigate('/logowanie', { replace: true });
    } catch (e) {
      setLogoutError(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader eyebrow={me.company.name} title="Firma i logo" />
      <div className="flex flex-col gap-4 px-5 pb-6 lg:max-w-[1080px] lg:px-0">
        <CompanyForm
          me={me}
          finishOnboarding={false}
          withPreview
          onSaved={() => setSaved(true)}
          actions={(busy) => (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
              {saved && !busy && <Notice tone="success">Zapisano.</Notice>}
              <Button type="submit" size="main" disabled={busy} className="lg:w-auto lg:min-h-[52px] lg:px-6">
                Zapisz zmiany
              </Button>
            </div>
          )}
        />
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <p className="m-0 text-[13px] text-muted">
            Zalogowano jako {me.user.phoneNumber ? formatPlPhone(me.user.phoneNumber) : me.user.email}
          </p>
          <Button variant="secondary" className="self-start" onClick={() => void logout()}>
            Wyloguj się
          </Button>
          {logoutError && <Notice tone="error">{logoutError}</Notice>}
        </div>
      </div>
    </>
  );
}
