import type { ReactNode } from 'react';
import { Link } from 'react-router';

interface OnboardingShellProps {
  step: 1 | 2 | 3;
  /** Small line above the title, e.g. „Krok 2 z 3 · Glazurnik”. Defaults to „Krok n z 3”. */
  eyebrow?: ReactNode;
  title: string;
  description: ReactNode;
  children: ReactNode;
  /** Sticky bottom area on the phone (main button). */
  footer?: ReactNode;
  /** Wider desktop layout (Dane firmy with the preview column). */
  wide?: boolean;
}

function Progress({ step, className }: { step: number; className?: string }) {
  return (
    <div className={`grid grid-cols-3 gap-1.5 ${className ?? ''}`} aria-hidden>
      {[1, 2, 3].map((n) => (
        <div key={n} className={`h-1 rounded-sm ${n <= step ? 'bg-accent' : 'bg-[#DDD7CC]'}`} />
      ))}
    </div>
  );
}

/** Layout of the 3 onboarding steps (mockups Profesja, Stawki, DaneFirmy, DaneFirmyDesktop). */
export function OnboardingShell({
  step,
  eyebrow,
  title,
  description,
  children,
  footer,
  wide,
}: OnboardingShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Desktop top bar */}
      <header className="hidden border-b border-line lg:block">
        <div className="mx-auto flex h-[62px] max-w-[1080px] items-center justify-between px-6">
          <Link to="/" className="font-display text-[22px] font-bold text-accent">
            Wycenka
          </Link>
          <div className="flex items-center gap-3 text-[13px] text-muted">
            Krok {step} z 3
            <Progress step={step} className="w-[180px]" />
          </div>
        </div>
      </header>

      <div
        className={`mx-auto flex w-full flex-1 flex-col lg:px-6 lg:py-10 ${wide ? 'max-w-[480px] lg:max-w-[1080px]' : 'max-w-[480px] lg:max-w-[720px]'}`}
      >
        <div className="flex flex-col gap-2 px-5 pt-7 pb-4 lg:px-0 lg:pt-0">
          <Progress step={step} className="mb-3 lg:hidden" />
          <p className="m-0 text-[13px] text-muted">{eyebrow ?? `Krok ${step} z 3`}</p>
          <h1 className="m-0 font-display text-[28px] leading-tight font-bold tracking-[-0.5px] lg:text-[34px]">
            {title}
          </h1>
          <p className="m-0 text-sm leading-5 text-ink-2 lg:text-[15px]">{description}</p>
        </div>

        <div className="flex flex-1 flex-col gap-3 px-5 lg:px-0">{children}</div>
        {footer && (
          <div className="sticky bottom-0 bg-bg px-5 pt-4 pb-7 lg:static lg:px-0 lg:pt-6">{footer}</div>
        )}
      </div>
    </div>
  );
}
