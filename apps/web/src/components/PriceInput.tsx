import { forwardRef, type InputHTMLAttributes } from 'react';
import { isInvalidPrice } from '../lib/price';

interface PriceInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name, e.g. „Cena netto: Skucie płytek”. */
  label: string;
  /** Empty value looks like a dashed placeholder (Stawki mockup). */
  dashedWhenEmpty?: boolean;
}

/** Right-aligned net price field in złoty („45”, „45,50”); parse with parsePLN. */
export const PriceInput = forwardRef<HTMLInputElement, PriceInputProps>(function PriceInput(
  { value, onValueChange, label, dashedWhenEmpty = true, className, ...props },
  ref,
) {
  const invalid = isInvalidPrice(value);
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      inputMode="decimal"
      autoComplete="off"
      aria-label={label}
      aria-invalid={invalid || undefined}
      placeholder="—"
      className={`min-h-11 w-[84px] rounded-[10px] px-2.5 text-right text-[15px] font-medium text-ink placeholder:text-muted focus:border-solid focus:border-ink focus:bg-surface focus:outline-none ${
        invalid
          ? 'border border-accent'
          : dashedWhenEmpty && value.trim() === ''
            ? 'border border-dashed border-[#B9B1A2] bg-[#FAF8F4]'
            : 'border border-line-strong bg-surface'
      } ${className ?? ''}`}
      {...props}
    />
  );
});
