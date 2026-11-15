import { parsePLN, priceInputText, unitLabel, type PriceListEntry, type Unit } from '@wycenka/core';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Field, Notice, Select, TextInput } from '../../components/fields';
import { Modal } from '../../components/Modal';
import { PriceInput } from '../../components/PriceInput';
import { UNITS } from '../../components/useRatesEditor';
import { errorMessage } from '../../lib/api';
import { usePriceListMutations } from '../../lib/priceList';

interface ItemDialogProps {
  /** null = new item */
  item: PriceListEntry | null;
  open: boolean;
  categories: string[];
  defaultCategory?: string | undefined;
  onClose: () => void;
}

export function ItemDialog(props: ItemDialogProps) {
  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.item ? 'Pozycja w cenniku' : 'Nowa pozycja'}
    >
      <ItemForm {...props} />
    </Modal>
  );
}

function ItemForm({ item, categories, defaultCategory, onClose }: ItemDialogProps) {
  const { create, update, archive } = usePriceListMutations();
  const [name, setName] = useState(item?.name ?? '');
  const [offerName, setOfferName] = useState(item?.offerName ?? '');
  const [category, setCategory] = useState(item?.category ?? defaultCategory ?? categories[0] ?? '');
  const [unit, setUnit] = useState<Unit>(item?.unit ?? 'm2');
  const [price, setPrice] = useState(priceInputText(item?.priceGr ?? null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const busy = create.isPending || update.isPending || archive.isPending;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Wpisz nazwę pozycji.';
    if (!category.trim()) next.category = 'Wpisz kategorię.';
    const priceGr = parsePLN(price);
    if (priceGr === null) next.price = 'Wpisz cenę, np. 45 albo 45,50.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input = {
      name: name.trim(),
      offerName: offerName.trim() || null,
      category: category.trim(),
      unit,
      priceGr: priceGr!,
    };
    try {
      if (item) await update.mutateAsync({ id: item.id, patch: input });
      else await create.mutateAsync(input);
      onClose();
    } catch (err) {
      setServerError(errorMessage(err));
    }
  }

  async function remove() {
    if (!item) return;
    if (!window.confirm(`Usunąć „${item.name}” z cennika? Wysłane oferty się nie zmienią.`)) return;
    try {
      await archive.mutateAsync(item.id);
      onClose();
    } catch (err) {
      setServerError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-3.5 pt-2">
      <Field label="Nazwa w cenniku" htmlFor="item-name" error={errors.name}>
        <TextInput
          id="item-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="np. Brodzik walk-in"
          invalid={!!errors.name}
          autoFocus={!item}
        />
      </Field>
      <Field
        label="Nazwa na ofercie (opcjonalnie)"
        htmlFor="item-offer-name"
        hint="Gdy klient ma zobaczyć inną nazwę, np. „Montaż brodzika walk-in”."
      >
        <TextInput
          id="item-offer-name"
          value={offerName}
          onChange={(e) => setOfferName(e.target.value)}
          placeholder={name || 'np. Montaż brodzika walk-in'}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Kategoria" htmlFor="item-category" error={errors.category} className="col-span-2">
          <TextInput
            id="item-category"
            list="item-categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            invalid={!!errors.category}
          />
          <datalist id="item-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Cena netto (zł)" htmlFor="item-price" error={errors.price}>
          <PriceInput
            id="item-price"
            label="Cena netto (zł)"
            value={price}
            onValueChange={setPrice}
            dashedWhenEmpty={false}
            className="min-h-12 w-full"
          />
        </Field>
        <Field label="Jednostka" htmlFor="item-unit">
          <Select id="item-unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                zł / {unitLabel(u)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {serverError && <Notice tone="error">{serverError}</Notice>}

      <Button type="submit" size="main" variant="dark" disabled={busy}>
        {item ? 'Zapisz zmiany' : 'Dodaj do cennika'}
      </Button>
      {item && (
        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy}
          className="min-h-11 text-[15px] font-medium text-accent underline"
        >
          Usuń z cennika
        </button>
      )}
    </form>
  );
}
