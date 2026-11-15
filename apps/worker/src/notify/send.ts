import { maskPhone } from '@wycenka/core';
import type { Env } from '../env';
import { deliverToDevOutbox } from './outbox';

/** Login codes by SMS (SMSAPI.pl). Offers are never sent by SMS from the server. */
export async function sendSms(env: Env, phoneE164: string, text: string): Promise<void> {
  if (!env.SMSAPI_TOKEN) return deliverToDevOutbox(env, { channel: 'sms', to: phoneE164, text });

  const body = new URLSearchParams({
    to: phoneE164.replace(/^\+/, ''),
    message: text,
    format: 'json',
    encoding: 'utf-8',
  });
  if (env.SMSAPI_SENDER) body.set('from', env.SMSAPI_SENDER);

  const res = await fetch('https://api.smsapi.pl/sms.do', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SMSAPI_TOKEN}` },
    body,
  });
  const json = (await res.json().catch(() => null)) as { error?: number; message?: string } | null;
  if (!res.ok || json?.error) {
    console.error('sms_failed', maskPhone(phoneE164), res.status, json?.error ?? '');
    throw new Error('SMS delivery failed');
  }
}

/** Transactional e-mail (Resend). */
export async function sendEmail(env: Env, to: string, subject: string, text: string): Promise<void> {
  if (!env.RESEND_API_KEY) return deliverToDevOutbox(env, { channel: 'email', to, subject, text });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM ?? 'Wycenka <no-reply@wycenka.pl>', to, subject, text }),
  });
  if (!res.ok) {
    console.error('email_failed', res.status);
    throw new Error('E-mail delivery failed');
  }
}
