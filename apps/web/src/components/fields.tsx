import { inputClass, labelClass } from './fieldClasses';
import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, error, hint, className, children }: FieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {error ? (
        <span role="alert" className="text-[13px] text-accent">
          {error}
        </span>
      ) : (
        hint && <span className="text-xs leading-[17px] text-muted">{hint}</span>
      )}
    </div>
  );
}

export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { large?: boolean; invalid?: boolean }
>(function TextInput({ large, invalid, className, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`${inputClass({ large, invalid })} ${className ?? ''}`}
      {...props}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={`min-h-12 w-full rounded-[10px] border border-line-strong bg-surface px-2.5 text-[15px] text-ink focus:border-ink focus:outline-none ${className ?? ''}`}
      {...props}
    />
  );
});

/** Bordered white group with an uppercase legend („Domyślne warunki oferty”, categories). */
export function Group({
  legend,
  children,
  className,
}: {
  legend: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset
      className={`m-0 min-w-0 rounded-[14px] border border-line bg-surface px-3.5 pt-1 pb-3.5 ${className ?? ''}`}
    >
      <legend className="px-1.5 text-xs font-semibold tracking-[0.8px] text-muted uppercase">{legend}</legend>
      {children}
    </fieldset>
  );
}

export function Notice({ tone, children }: { tone: 'success' | 'error'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`m-0 rounded-[10px] px-3 py-2.5 text-[13px] ${
        tone === 'success' ? 'bg-success-bg text-success' : 'bg-accent-tint text-accent'
      }`}
    >
      {children}
    </p>
  );
}
