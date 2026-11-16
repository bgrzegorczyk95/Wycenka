import { MAX_PHOTOS, MAX_RECORDING_MS } from '@wycenka/core';
import { useQueryClient } from '@tanstack/react-query';
import { liveQuery } from 'dexie';
import { ChevronLeft, Mic, Plus, Square, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { Field, Notice, TextInput } from '../../components/fields';
import { compressPhoto } from '../../lib/image';
import { OFFERS_KEY } from '../../lib/offers';
import { useMe } from '../../lib/session';
import type { LocalFile, LocalOffer } from '../../offline/db';
import {
  addFile,
  discardOffer,
  draftFiles,
  loadOrCreateDraft,
  queueDraft,
  removeFile,
  syncQueue,
  updateDraftClient,
  updateFileCaption,
} from '../../offline/queue';
import { mmss, recordingSupported, useRecorder } from '../../offline/recorder';

/** Object URLs for recordings and photos stored in IndexedDB (revoked when files change). */
function useObjectUrls(files: LocalFile[]) {
  const urls = useMemo(
    () => new Map(files.map((f) => [f.id, URL.createObjectURL(new Blob([f.data], { type: f.mime }))])),
    [files],
  );
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}

/** Screen 2 (Oględziny): client, recording, photos. Everything is kept on the phone until sent. */
export function NewOfferPage() {
  const [draft, setDraft] = useState<LocalOffer | null>(null);
  useEffect(() => {
    void loadOrCreateDraft().then(setDraft);
  }, []);
  if (!draft) return null;
  return <DraftForm key={draft.clientUuid} draft={draft} onReset={(d) => setDraft(d)} />;
}

function DraftForm({ draft, onReset }: { draft: LocalOffer; onReset: (d: LocalOffer) => void }) {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [client, setClient] = useState(draft.client);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const urls = useObjectUrls(files);
  const mockAi = me?.features.mockAi ?? false;

  useEffect(() => {
    const sub = liveQuery(() => draftFiles(draft.clientUuid)).subscribe({ next: setFiles });
    return () => sub.unsubscribe();
  }, [draft.clientUuid]);

  // Client fields are saved as you type – closing the tab loses nothing.
  useEffect(() => {
    const t = setTimeout(() => void updateDraftClient(draft.clientUuid, client), 300);
    return () => clearTimeout(t);
  }, [client, draft.clientUuid]);

  const recordings = files.filter((f) => f.kind === 'audio');
  const photos = files.filter((f) => f.kind === 'photo');
  const recordedMs = recordings.reduce((s, f) => s + (f.durationMs ?? 0), 0);
  const recorder = useRecorder(
    (s) =>
      addFile({
        id: crypto.randomUUID(),
        clientUuid: draft.clientUuid,
        kind: 'audio',
        mime: s.mime,
        data: s.data,
        durationMs: s.durationMs,
      }).then(() => undefined),
    MAX_RECORDING_MS - recordedMs,
  );
  const recording = recorder.state === 'recording';

  async function addPhotos(list: FileList | null) {
    if (!list) return;
    setError(null);
    let n = photos.length;
    for (const file of Array.from(list)) {
      if (n >= MAX_PHOTOS) {
        setError(`Najwyżej ${MAX_PHOTOS} zdjęć na ofertę.`);
        break;
      }
      try {
        const data = await compressPhoto(file);
        n++;
        await addFile({
          id: crypto.randomUUID(),
          clientUuid: draft.clientUuid,
          kind: 'photo',
          mime: 'image/jpeg',
          data,
          caption: `Zdjęcie ${n}`,
        });
      } catch {
        setError('Nie udało się wczytać zdjęcia.');
      }
    }
  }

  async function finish(process: boolean) {
    if (client.name.trim().length < 2) return setNameError('Wpisz imię i nazwisko klienta.');
    if (process && recordings.length === 0 && !mockAi) {
      return setError('Nagraj opis oględzin albo wybierz „Uzupełnij ręcznie”.');
    }
    setNameError(null);
    setError(null);
    setBusy(true);
    recorder.stop();
    await updateDraftClient(draft.clientUuid, { ...client, name: client.name.trim() });
    await queueDraft(draft.clientUuid, process);
    const result = await syncQueue();
    void queryClient.invalidateQueries({ queryKey: OFFERS_KEY });
    const sent = result.sent.find((s) => s.clientUuid === draft.clientUuid);
    navigate(sent ? `/oferty/${sent.offerId}` : '/oferty/oczekujace', { replace: true });
  }

  async function startOver() {
    if (!window.confirm('Usunąć nagrania i zdjęcia tej oferty i zacząć od nowa?')) return;
    recorder.stop();
    await discardOffer(draft.clientUuid);
    onReset(await loadOrCreateDraft());
  }

  const set = (patch: Partial<LocalOffer['client']>) => setClient((c) => ({ ...c, ...patch }));

  return (
    <div className="flex flex-1 flex-col px-5 pb-6 lg:max-w-[560px] lg:px-0">
      <Link
        to="/oferty"
        className="inline-flex min-h-11 items-center gap-1.5 self-start pt-3 text-sm font-medium text-muted"
      >
        <ChevronLeft size={18} aria-hidden /> Oferty
      </Link>
      <h1 className="mt-2 mb-4 font-display text-[34px] font-bold tracking-[-0.5px]">Nowa oferta</h1>

      <div className="flex flex-col gap-3.5">
        <Field label="Klient" htmlFor="client-name" error={nameError ?? undefined}>
          <TextInput
            id="client-name"
            value={client.name}
            onChange={(e) => set({ name: e.target.value })}
            autoComplete="off"
            placeholder="Imię i nazwisko"
            invalid={!!nameError}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Telefon" htmlFor="client-phone">
            <TextInput
              id="client-phone"
              type="tel"
              inputMode="tel"
              value={client.phone}
              onChange={(e) => set({ phone: e.target.value })}
              placeholder="np. 600 000 000"
            />
          </Field>
          <Field label="Adres" htmlFor="client-address">
            <TextInput
              id="client-address"
              value={client.address}
              onChange={(e) => set({ address: e.target.value })}
              placeholder="Ulica, dzielnica"
            />
          </Field>
        </div>

        {/* Recording */}
        <section className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-5 py-6 text-center">
          {recordingSupported() ? (
            <>
              <button
                type="button"
                onClick={() => (recording ? recorder.stop() : void recorder.start())}
                disabled={recorder.state === 'starting'}
                aria-label={
                  recording ? 'Zatrzymaj nagrywanie' : recordings.length ? 'Dograj nagranie' : 'Nagraj opis'
                }
                className={`flex size-[112px] items-center justify-center rounded-[36px] bg-accent text-white ring-[10px] ring-accent-tint transition ${
                  recording ? 'scale-100' : 'hover:brightness-95'
                }`}
              >
                {recording ? (
                  <Square size={28} fill="currentColor" aria-hidden />
                ) : (
                  <Mic size={40} aria-hidden />
                )}
              </button>
              <p className="m-0 text-[17px] font-semibold" aria-live="polite">
                {recording
                  ? `Nagrywanie · ${mmss(recorder.elapsedMs)}`
                  : recordings.length
                    ? `Nagrano ${mmss(recordedMs)} · dotknij, żeby dograć`
                    : 'Dotknij, żeby nagrać opis'}
              </p>
              <p className="m-0 text-sm text-muted">
                Powiedz: pomieszczenie, wymiary, zakres prac i czyj materiał.
              </p>
            </>
          ) : (
            <p className="m-0 text-[15px] text-ink-2">
              Ta przeglądarka nie nagrywa dźwięku. Uzupełnij ofertę ręcznie albo użyj Chrome lub Safari.
            </p>
          )}
          {recorder.error && <Notice tone="error">{recorder.error}</Notice>}
          {recordings.length > 0 && (
            <ul className="m-0 flex w-full list-none flex-col gap-2 p-0 text-left">
              {recordings.map((r, i) => (
                <li key={r.id} className="flex items-center gap-2 rounded-field bg-sand px-3 py-2">
                  <span className="shrink-0 text-sm font-semibold">
                    {i + 1}. {mmss(r.durationMs ?? 0)}
                  </span>
                  <audio controls preload="none" src={urls.get(r.id)} className="h-9 min-w-0 flex-1" />
                  <button
                    type="button"
                    onClick={() => void removeFile(r.id)}
                    aria-label={`Usuń nagranie ${i + 1}`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-[10px] text-muted hover:bg-bg"
                  >
                    <Trash2 size={18} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Photos */}
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-[15px] font-semibold text-ink-2">Zdjęcia ({photos.length})</h2>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((p) => (
              <figure key={p.id} className="relative m-0">
                <img
                  src={urls.get(p.id)}
                  alt={p.caption ?? 'Zdjęcie'}
                  className="aspect-square w-full rounded-[12px] object-cover"
                />
                <button
                  type="button"
                  onClick={() => void removeFile(p.id)}
                  aria-label={`Usuń zdjęcie ${p.caption ?? ''}`}
                  className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-ink/70 text-white"
                >
                  <X size={14} aria-hidden />
                </button>
                <input
                  aria-label="Podpis zdjęcia"
                  defaultValue={p.caption ?? ''}
                  maxLength={40}
                  onBlur={(e) => void updateFileCaption(p.id, e.target.value)}
                  className="mt-1 w-full rounded-[8px] border border-transparent bg-transparent px-1 text-[13px] text-ink-2 focus:border-line-strong focus:bg-surface focus:outline-none"
                />
              </figure>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => photoInput.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed border-[#B9B1A2] text-[15px] font-medium text-ink-2"
              >
                <Plus size={22} aria-hidden /> Dodaj
              </button>
            )}
          </div>
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void addPhotos(e.target.files);
              e.target.value = '';
            }}
          />
        </section>

        {error && <Notice tone="error">{error}</Notice>}

        <div className="mt-1 flex flex-col gap-2">
          <Button variant="dark" size="main" disabled={busy || recording} onClick={() => void finish(true)}>
            Gotowe – przygotuj ofertę
          </Button>
          <p className="m-0 text-center text-[13px] text-muted">
            AI ułoży pozycje z Twojego cennika. Ceny zawsze sprawdzasz Ty.
          </p>
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={busy}
              onClick={() => void finish(false)}
              className="min-h-11 text-[15px] font-semibold text-ink underline"
            >
              Uzupełnij ręcznie
            </button>
            {(files.length > 0 || client.name) && (
              <button
                type="button"
                onClick={() => void startOver()}
                className="min-h-11 text-sm text-muted underline"
              >
                Zacznij od nowa
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
