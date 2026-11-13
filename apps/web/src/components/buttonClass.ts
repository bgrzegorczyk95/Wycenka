export type Variant = 'accent' | 'dark' | 'secondary';
export type Size = 'main' | 'normal';

const variants: Record<Variant, string> = {
  accent: 'bg-accent text-white hover:brightness-95',
  dark: 'bg-ink text-white hover:brightness-110',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-bg',
};

const sizes: Record<Size, string> = {
  // Main action: 56 px high, full width on the phone.
  main: 'min-h-14 w-full rounded-button px-5 text-[17px] font-semibold',
  normal: 'min-h-11 rounded-[10px] px-4 text-sm font-semibold',
};

export function buttonClass(variant: Variant = 'accent', size: Size = 'normal'): string {
  return [
    'inline-flex items-center justify-center gap-2.5 transition disabled:cursor-not-allowed disabled:opacity-50',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    variants[variant],
    sizes[size],
  ].join(' ');
}
