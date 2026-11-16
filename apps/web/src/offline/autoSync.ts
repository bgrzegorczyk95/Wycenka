import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { syncQueue, waitingOffers, type SyncResult, type WaitingOffer } from './queue';

const RETRY_MS = 30_000;

/**
 * Sends waiting offers: at start, when the connection is back, when the app comes to the foreground
 * and every 30 s while something waits (docs/03). iOS has no Background Sync – hence „wyślemy przy
 * następnym otwarciu”.
 */
export function startAutoSync(onResult: (r: SyncResult) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const run = async () => {
    clearTimeout(timer);
    const result = await syncQueue();
    if (stopped) return;
    onResult(result);
    if (result.pending > 0 && !result.unauthorized) timer = setTimeout(() => void run(), RETRY_MS);
  };
  const onVisible = () => document.visibilityState === 'visible' && void run();
  const onOnline = () => void run();

  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  void run();
  return () => {
    stopped = true;
    clearTimeout(timer);
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

/** Offers waiting on the phone, updated live from IndexedDB. */
export function useWaitingOffers(): WaitingOffer[] | undefined {
  const [offers, setOffers] = useState<WaitingOffer[]>();
  useEffect(() => {
    const sub = liveQuery(() => waitingOffers()).subscribe({ next: setOffers, error: () => setOffers([]) });
    return () => sub.unsubscribe();
  }, []);
  return offers;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
