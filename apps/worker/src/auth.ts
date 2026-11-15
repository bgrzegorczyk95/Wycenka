import { authSchema } from '@wycenka/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP, phoneNumber } from 'better-auth/plugins';
import { getDb } from './db';
import type { Env } from './env';
import { sendEmail, sendSms } from './notify/send';

/** Placeholder e-mail for accounts created by phone (Better Auth requires an e-mail). */
export const PHONE_EMAIL_DOMAIN = 'phone.wycenka.invalid';

const OTP_TTL_SECONDS = 300;

export function createAuth(env: Env) {
  return betterAuth({
    appName: 'Wycenka',
    baseURL: env.APP_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    database: drizzleAdapter(getDb(env), { provider: 'sqlite', schema: authSchema }),
    user: {
      additionalFields: {
        companyId: { type: 'string', required: false, input: false },
        role: { type: 'string', required: false, defaultValue: 'owner', input: false },
      },
    },
    session: {
      // Contractors log in on their phone and should rarely have to do it again.
      expiresIn: 60 * 60 * 24 * 90,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: env.AUTH_RATE_LIMIT !== 'off',
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        // docs/06-api.md: codes are limited; per-number limits come with M10 hardening.
        '/phone-number/send-otp': { window: 600, max: 3 },
        '/email-otp/send-verification-otp': { window: 600, max: 3 },
        '/phone-number/verify': { window: 600, max: 10 },
        '/sign-in/email-otp': { window: 600, max: 10 },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      database: { generateId: () => crypto.randomUUID() },
    },
    plugins: [
      phoneNumber({
        otpLength: 6,
        expiresIn: OTP_TTL_SECONDS,
        allowedAttempts: 3,
        phoneNumberValidator: (p) => /^\+48\d{9}$/.test(p),
        sendOTP: ({ phoneNumber: phone, code }) =>
          sendSms(env, phone, `Wycenka: kod logowania ${code}. Nie podawaj go nikomu.`),
        signUpOnVerification: {
          getTempEmail: (phone) => `${phone.replace(/\D/g, '')}@${PHONE_EMAIL_DOMAIN}`,
          getTempName: () => '',
        },
      }),
      emailOTP({
        otpLength: 6,
        expiresIn: OTP_TTL_SECONDS,
        allowedAttempts: 3,
        sendVerificationOTP: ({ email, otp }) =>
          sendEmail(
            env,
            email,
            'Kod logowania do Wycenki',
            `Twój kod logowania: ${otp}\n\nKod jest ważny 5 minut. Jeśli to nie Ty, zignoruj tę wiadomość.`,
          ),
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
