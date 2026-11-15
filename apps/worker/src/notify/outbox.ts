import { maskPhone } from '@wycenka/core';
import type { Env } from '../env';

export interface OutboxMessage {
  channel: 'sms' | 'email';
  to: string;
  subject?: string;
  text: string;
}

/**
 * Development stand-in for SMS / e-mail providers: messages are kept in memory (read by tests)
 * and printed to the `wrangler dev` console. Refuses to work in production.
 */
export const devOutbox: OutboxMessage[] = [];

export function deliverToDevOutbox(env: Pick<Env, 'ENVIRONMENT'>, message: OutboxMessage): void {
  if (env.ENVIRONMENT === 'production') {
    throw new Error(`No ${message.channel} provider configured in production`);
  }
  devOutbox.push(message);
  const to =
    message.channel === 'sms' ? maskPhone(message.to) : message.to.replace(/^(.).*(@.*)$/, '$1***$2');
  console.log(`[dev ${message.channel}] to ${to}: ${message.text}`);
}
