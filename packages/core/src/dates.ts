import { TIME_ZONE } from './plans';

const dateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Calendar day in Europe/Warsaw: '2026-11-13'. */
export function warsawDate(at: Date | number): string {
  return dateFormat.format(at);
}

/** '2026-11-13' + 14 → '2026-11-27' (calendar arithmetic, no time zone involved). */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** '2026-11-27' → „27.11.2026”. */
export function formatDatePl(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

const dateTimeFormat = new Intl.DateTimeFormat('pl-PL', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** ms → „13.11.2026, 19:42” in Europe/Warsaw. */
export function formatDateTimePl(at: Date | number): string {
  return dateTimeFormat.format(at);
}

const MONTHS_GENITIVE = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
];

/** ms → „13 listopada” (oględziny z 13 listopada). */
export function formatDayMonthPl(at: Date | number): string {
  const [, m, d] = warsawDate(at).split('-');
  return `${Number(d)} ${MONTHS_GENITIVE[Number(m) - 1]}`;
}
