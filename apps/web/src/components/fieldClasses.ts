/** Text inputs: 48 px, radius 10 (DaneFirmy); `large` = 52 px, radius 12, 17 px (Logowanie). */
export function inputClass(opts: { large?: boolean; invalid?: boolean } = {}): string {
  return [
    'w-full min-w-0 border bg-surface text-ink placeholder:text-muted/70',
    'focus:border-ink focus:outline-none',
    opts.large ? 'min-h-[52px] rounded-field px-3.5 text-[17px]' : 'min-h-12 rounded-[10px] px-3 text-[15px]',
    opts.invalid ? 'border-accent' : 'border-line-strong',
  ].join(' ');
}

export const labelClass = 'text-[13px] font-semibold text-ink-2';
