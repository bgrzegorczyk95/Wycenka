import { parsePLN, priceInputText, type PriceListEntry } from '@wycenka/core';
import { useState } from 'react';
import { PriceInput } from '../../components/PriceInput';
import { errorMessage } from '../../lib/api';
import { usePriceListMutations } from '../../lib/priceList';

/** Desktop table: edit the price in the cell (CennikDesktop „edycja w komórce”). Saves on blur or Enter. */
export function PriceCell({ item }: { item: PriceListEntry }) {
  const { update } = usePriceListMutations();
  const [text, setText] = useState(() => priceInputText(item.priceGr));
  const [error, setError] = useState<string | null>(null);
  const [savedFor, setSavedFor] = useState(item.priceGr);

  // The list was updated elsewhere (dialog, phone layout) – follow it unless the user is typing.
  if (item.priceGr !== savedFor) {
    setSavedFor(item.priceGr);
    setText(priceInputText(item.priceGr));
  }

  /** Takes the value from the field itself – state may not be re-rendered yet (autofill, fast Tab). */
  async function commit(value: string) {
    const priceGr = parsePLN(value);
    if (priceGr === null) {
      setError(
        value.trim() === ''
          ? 'Cena jest wymagana. Usuń pozycję, jeśli jej nie robisz.'
          : 'Wpisz kwotę, np. 45.',
      );
      return;
    }
    setError(null);
    if (priceGr === item.priceGr) return;
    try {
      await update.mutateAsync({ id: item.id, patch: { priceGr } });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <PriceInput
        label={`Cena: ${item.name.toLowerCase()}`}
        value={text}
        onValueChange={setText}
        dashedWhenEmpty={false}
        onBlur={(e) => void commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setText(priceInputText(item.priceGr));
            setError(null);
          }
        }}
        aria-busy={update.isPending || undefined}
        aria-invalid={!!error || undefined}
        className={`w-24 ${error ? 'border-accent' : ''} ${update.isPending ? 'opacity-60' : ''}`}
      />
      {error && (
        <span role="alert" className="max-w-[220px] text-right text-xs text-accent">
          {error}
        </span>
      )}
    </div>
  );
}
