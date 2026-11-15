import type { MeResponse, OnboardingStep } from '@wycenka/core';
import { useQuery } from '@tanstack/react-query';
import { api, ApiRequestError } from './api';

export async function fetchMe(): Promise<MeResponse | null> {
  try {
    return await api<MeResponse>('/api/me');
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 401) return null;
    throw e;
  }
}

export const ME_KEY = ['me'] as const;
export const RATES_KEY = ['onboarding', 'rates'] as const;

/** Current user + company; `null` when not logged in. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: fetchMe,
    retry: (count, e) => !(e instanceof ApiRequestError && e.status === 401) && count < 2,
  });
}

export const ONBOARDING_STEPS = ['profesja', 'stawki', 'firma'] as const;

/** Where a logged-in user belongs right now. */
export function homePath(me: MeResponse): string {
  return me.needsOnboarding ? onboardingPath(me.onboardingStep) : '/oferty';
}

export function onboardingPath(step: OnboardingStep): string {
  return `/start/${step ?? 'profesja'}`;
}
