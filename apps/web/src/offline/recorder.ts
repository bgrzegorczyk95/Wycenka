import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Voice recording with MediaRecorder (docs/03): Chrome/Android → audio/webm;codecs=opus,
 * iOS Safari → audio/mp4. The actual MIME type is stored with the file.
 */

const CANDIDATES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];

export function recordingSupported(): boolean {
  return typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia;
}

function pickMime(): string {
  return CANDIDATES.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? '';
}

export interface Segment {
  data: ArrayBuffer;
  mime: string;
  durationMs: number;
}

export type RecorderState = 'idle' | 'starting' | 'recording';

/**
 * `remainingMs`: how much of the 5-minute limit is left; recording stops by itself at the limit.
 * Leaving the app (screen off, switching apps) stops the recording and keeps what was said.
 */
export function useRecorder(onSegment: (s: Segment) => void | Promise<void>, remainingMs: number) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);
  const onSegmentRef = useRef(onSegment);
  useEffect(() => {
    onSegmentRef.current = onSegment;
  }, [onSegment]);

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!recordingSupported())
      return setError('Ta przeglądarka nie nagrywa dźwięku. Spróbuj w Chrome albo Safari.');
    if (remainingMs <= 0) return setError('Nagrania mogą trwać łącznie najwyżej 5 minut.');
    setState('starting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      setState('idle');
      const name = (e as DOMException).name;
      return setError(
        name === 'NotAllowedError'
          ? 'Brak dostępu do mikrofonu. Zezwól na mikrofon w ustawieniach przeglądarki.'
          : 'Nie udało się włączyć mikrofonu.',
      );
    }
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const durationMs = Date.now() - startedAt.current;
      recorder.current = null;
      setState('idle');
      setElapsedMs(0);
      const type = rec.mimeType || mime || 'audio/webm';
      const blob = new Blob(chunks, { type });
      if (blob.size > 0 && durationMs > 500) {
        await onSegmentRef.current({ data: await blob.arrayBuffer(), mime: type, durationMs });
      }
    };
    recorder.current = rec;
    startedAt.current = Date.now();
    rec.start(1000);
    setState('recording');
  }, [remainingMs]);

  // Timer + automatic stop at the limit
  useEffect(() => {
    if (state !== 'recording') return;
    const t = setInterval(() => {
      const ms = Date.now() - startedAt.current;
      setElapsedMs(ms);
      if (ms >= remainingMs) stop();
    }, 250);
    return () => clearInterval(t);
  }, [state, remainingMs, stop]);

  // Leaving the app keeps what was recorded (iOS stops the microphone in the background anyway).
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && stop();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', stop);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', stop);
      stop();
    };
  }, [stop]);

  return { state, elapsedMs, error, start, stop };
}

export const mmss = (ms: number) => {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
