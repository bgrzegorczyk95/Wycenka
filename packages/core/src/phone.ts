/** Normalizes a Polish mobile/landline number to E.164 (+48XXXXXXXXX). Returns null when invalid. */
export function normalizePlPhone(input: string): string | null {
  const compact = input.replace(/[\s-]/g, '');
  const match = /^(?:\+48|0048|48)?(\d{9})$/.exec(compact);
  return match ? `+48${match[1]}` : null;
}

/** +48600000000 → „600 000 000”. Other values are returned unchanged. */
export function formatPlPhone(e164: string): string {
  const match = /^\+48(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return match ? `${match[1]} ${match[2]} ${match[3]}` : e164;
}

/** For logs: never write full phone numbers (RODO). */
export function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}•••••${phone.slice(-4)}`;
}
