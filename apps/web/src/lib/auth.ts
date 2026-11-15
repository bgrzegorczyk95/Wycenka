import { ApiRequestError } from './api';

/** Better Auth endpoints (plugins phone number + email OTP), see apps/worker/src/auth.ts. */

const MESSAGES: Record<string, string> = {
  INVALID_OTP: 'Nieprawidłowy kod. Sprawdź i spróbuj ponownie.',
  OTP_EXPIRED: 'Kod wygasł. Wyślij nowy.',
  OTP_NOT_FOUND: 'Kod wygasł. Wyślij nowy.',
  TOO_MANY_ATTEMPTS: 'Za dużo prób. Wyślij nowy kod.',
  TOO_MANY_REQUESTS: 'Za dużo prób. Spróbuj ponownie za kilka minut.',
  INVALID_PHONE_NUMBER: 'Wpisz 9 cyfr numeru telefonu.',
  INVALID_EMAIL: 'Nieprawidłowy adres e-mail.',
};

async function post(path: string, body: unknown): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/auth${path}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError(0, 'network', 'Brak połączenia. Sprawdź internet i spróbuj ponownie.');
  }
  if (res.ok) return;
  const json = (await res.json().catch(() => null)) as { code?: string } | null;
  const code = res.status === 429 ? 'TOO_MANY_REQUESTS' : (json?.code ?? 'UNKNOWN');
  throw new ApiRequestError(res.status, code, MESSAGES[code] ?? 'Nie udało się zalogować. Spróbuj ponownie.');
}

export const sendPhoneCode = (phoneNumber: string) => post('/phone-number/send-otp', { phoneNumber });
export const verifyPhoneCode = (phoneNumber: string, code: string) =>
  post('/phone-number/verify', { phoneNumber, code });
export const sendEmailCode = (email: string) =>
  post('/email-otp/send-verification-otp', { email, type: 'sign-in' });
export const verifyEmailCode = (email: string, otp: string) => post('/sign-in/email-otp', { email, otp });
export const signOut = () => post('/sign-out', {});
