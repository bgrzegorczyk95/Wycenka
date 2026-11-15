import {
  CompanyInput,
  DEPOSIT_BPS,
  LOGO_MAX_BYTES,
  VALIDITY_DAYS,
  formatPercent,
  formatPlPhone,
  type CompanyData,
  type MeResponse,
} from '@wycenka/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ImageIcon } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useForm, useWatch, type Control } from 'react-hook-form';
import { api, errorMessage } from '../lib/api';
import { initials, logoUrl, squareLogo } from '../lib/image';
import { ME_KEY } from '../lib/session';
import { Field, Group, Notice, Select, TextInput } from './fields';

type FormValues = {
  ownerName: string;
  name: string;
  nip: string;
  phone: string;
  email: string;
  serviceArea: string;
  defaultValidityDays: number;
  defaultDepositBps: number;
  defaultVatBps: number | null;
};

const VAT_EXEMPT = 'zw';

function defaults(me: MeResponse): FormValues {
  const c = me.company;
  return {
    ownerName: me.user.name,
    name: c.name,
    nip: c.nip ?? '',
    phone: formatPlPhone(c.phone ?? me.user.phoneNumber ?? ''),
    email: c.email ?? me.user.email ?? '',
    serviceArea: c.serviceArea ?? '',
    defaultValidityDays: c.defaultValidityDays,
    defaultDepositBps: c.defaultDepositBps,
    defaultVatBps: c.defaultVatBps,
  };
}

export function CompanyBadge({
  name,
  logo,
  size = 46,
}: {
  name: string;
  logo: string | null;
  size?: number;
}) {
  return logo ? (
    <img src={logo} alt="" width={size} height={size} className="shrink-0 rounded-[10px] object-cover" />
  ) : (
    <span
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-[10px] bg-ink text-lg font-bold text-white"
    >
      {initials(name) || '–'}
    </span>
  );
}

interface CompanyFormProps {
  me: MeResponse;
  /** Onboarding step 3 finishes onboarding on submit. */
  finishOnboarding: boolean;
  /** Renders the action area; receives the submitting flag. */
  actions: (busy: boolean) => ReactNode;
  onSaved: (me: MeResponse) => void;
  /** Desktop preview column. */
  withPreview?: boolean;
}

export function CompanyForm({ me, finishOnboarding, actions, onSaved, withPreview }: CompanyFormProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues, unknown, CompanyData>({
    resolver: zodResolver(CompanyInput) as never,
    defaultValues: defaults(me),
  });

  const submit = handleSubmit(async (data) => {
    setError(null);
    try {
      const saved = await api<MeResponse>('/api/company', {
        method: 'PATCH',
        body: { ...data, finishOnboarding },
      });
      queryClient.setQueryData(ME_KEY, saved);
      onSaved(saved);
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  const form = (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-3.5">
      <div className="rounded-[14px] border border-line bg-surface p-3.5 lg:border-0 lg:p-0">
        <LogoPicker me={me} />
      </div>

      <Field
        label="Imię i nazwisko"
        htmlFor="ownerName"
        error={errors.ownerName?.message}
        hint="Podpiszemy nim wiadomość z ofertą do klienta."
      >
        <TextInput
          id="ownerName"
          autoComplete="name"
          placeholder="np. Marek Nowak"
          invalid={!!errors.ownerName}
          {...register('ownerName')}
        />
      </Field>

      <div className="grid grid-cols-2 gap-x-2.5 gap-y-3.5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Field
          label="Nazwa firmy"
          htmlFor="name"
          error={errors.name?.message}
          className="col-span-2 lg:col-span-1"
        >
          <TextInput
            id="name"
            autoComplete="organization"
            placeholder="np. Usługi Glazurnicze Nowak"
            invalid={!!errors.name}
            {...register('name')}
          />
        </Field>
        <Field label="NIP" htmlFor="nip" error={errors.nip?.message}>
          <TextInput
            id="nip"
            inputMode="numeric"
            placeholder="000-000-00-00"
            invalid={!!errors.nip}
            {...register('nip')}
          />
        </Field>
        <Field label="Telefon" htmlFor="phone" error={errors.phone?.message}>
          <TextInput
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="600 000 000"
            invalid={!!errors.phone}
            {...register('phone')}
          />
        </Field>
        {/* E-mail only in the desktop layout (DaneFirmyDesktop). */}
        <Field
          label="E-mail (opcjonalnie)"
          htmlFor="email"
          error={errors.email?.message}
          className="max-lg:hidden"
        >
          <TextInput
            id="email"
            type="email"
            autoComplete="email"
            placeholder="biuro@twojafirma.pl"
            invalid={!!errors.email}
            {...register('email')}
          />
        </Field>
      </div>

      <Field label="Obszar działania" htmlFor="serviceArea" error={errors.serviceArea?.message}>
        <TextInput id="serviceArea" placeholder="np. Warszawa i okolice" {...register('serviceArea')} />
      </Field>

      <Group legend="Domyślne warunki oferty" className="mt-1.5 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
          <Field label="Ważność oferty" htmlFor="validity">
            <Select id="validity" {...register('defaultValidityDays', { valueAsNumber: true })}>
              {VALIDITY_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d} dni
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Zaliczka" htmlFor="deposit">
            <Select id="deposit" {...register('defaultDepositBps', { valueAsNumber: true })}>
              {DEPOSIT_BPS.map((b) => (
                <option key={b} value={b}>
                  {b === 0 ? 'brak' : formatPercent(b)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Stawka VAT" htmlFor="vat" className="col-span-2 lg:col-span-1">
            <Select
              id="vat"
              {...register('defaultVatBps', {
                setValueAs: (v: string | number | null) =>
                  v === VAT_EXEMPT || v === null ? null : Number(v),
              })}
              defaultValue={me.company.defaultVatBps === null ? VAT_EXEMPT : String(me.company.defaultVatBps)}
            >
              <option value="800">8%</option>
              <option value="2300">23%</option>
              <option value={VAT_EXEMPT}>zwolniony z VAT</option>
            </Select>
          </Field>
        </div>
        <span className="text-xs leading-[17px] text-muted">
          Stawkę VAT ustal z księgową – zależy od rodzaju prac i budynku. Możesz ją zmienić w każdej ofercie.
        </span>
      </Group>

      {error && <Notice tone="error">{error}</Notice>}
      {actions(isSubmitting)}
    </form>
  );

  if (!withPreview) return form;
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-7">
      <div className="lg:rounded-card lg:border lg:border-line lg:bg-surface lg:p-6">{form}</div>
      <HeaderPreview control={control} me={me} />
    </div>
  );
}

function HeaderPreview({
  control,
  me,
}: {
  control: Control<FormValues, unknown, CompanyData>;
  me: MeResponse;
}) {
  const v = useWatch({ control });
  const meta = [v.phone ? `tel. ${v.phone}` : null, v.serviceArea || null].filter(Boolean).join(' · ');
  const vat =
    v.defaultVatBps === null
      ? 'Zwolniony z VAT'
      : `Ceny brutto z VAT ${formatPercent(Number(v.defaultVatBps ?? 800))}`;
  return (
    <aside className="hidden lg:block">
      <p className="m-0 mb-2 text-xs font-semibold tracking-[0.8px] text-muted uppercase">
        Podgląd na ofercie
      </p>
      <div className="rounded-card border border-line bg-surface p-5">
        <div className="flex items-start gap-3 border-b border-line pb-3.5">
          <CompanyBadge name={v.name ?? ''} logo={logoUrl(me)} />
          <div className="min-w-0">
            <p className="m-0 text-base font-semibold">{v.name || 'Nazwa firmy'}</p>
            {meta && <p className="m-0 text-[13px] text-muted">{meta}</p>}
          </div>
        </div>
        <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0 text-[13px] text-ink-2">
          <li>Oferta ważna {v.defaultValidityDays} dni</li>
          <li>
            {Number(v.defaultDepositBps) === 0
              ? 'Bez zaliczki'
              : `Zaliczka ${formatPercent(Number(v.defaultDepositBps))} przy rozpoczęciu`}
          </li>
          <li>{vat}</li>
        </ul>
      </div>
    </aside>
  );
}

function LogoPicker({ me }: { me: MeResponse }) {
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const url = logoUrl(me);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!['image/png', 'image/jpeg'].includes(file.type))
      return setError('Logo musi być plikiem PNG albo JPG.');
    if (file.size > LOGO_MAX_BYTES * 10) return setError('Ten plik jest za duży.');
    setBusy(true);
    try {
      const blob = await squareLogo(file);
      if (blob.size > LOGO_MAX_BYTES) throw new Error('Logo może mieć najwyżej 2 MB.');
      queryClient.setQueryData(
        ME_KEY,
        await api<MeResponse>('/api/company/logo', { method: 'PUT', raw: blob }),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      queryClient.setQueryData(ME_KEY, await api<MeResponse>('/api/company/logo', { method: 'DELETE' }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`flex items-center gap-3.5 rounded-[10px] ${dragging ? 'outline-2 outline-accent outline-dashed' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void upload(e.dataTransfer.files[0]);
      }}
    >
      {url ? (
        <img
          src={url}
          alt="Logo firmy"
          className="size-16 shrink-0 rounded-[14px] border border-line object-cover"
        />
      ) : (
        <div className="flex size-16 shrink-0 items-center justify-center rounded-[14px] border border-dashed border-[#B9B1A2] bg-[#FAF8F4]">
          <ImageIcon size={24} className="text-ink-2" aria-hidden />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="min-h-10 self-start rounded-[10px] border border-line-strong bg-surface px-3.5 text-sm font-semibold"
          >
            {url ? 'Zmień logo' : 'Dodaj logo'}
          </button>
          {url && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className="min-h-10 px-2 text-sm text-muted underline"
            >
              Usuń
            </button>
          )}
        </div>
        <span className="text-xs text-muted">
          {busy ? (
            'Wysyłam…'
          ) : (
            <>
              PNG lub JPG. <span className="lg:hidden">Możesz pominąć.</span>
              <span className="hidden lg:inline">Możesz przeciągnąć plik tutaj.</span>
            </>
          )}
        </span>
        {error && (
          <span role="alert" className="text-xs text-accent">
            {error}
          </span>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
