import type {
  AddOfferItemInput,
  GeometryInput,
  OfferDetail,
  OfferItemPatch,
  OfferListItem,
  OfferPatch,
  OfferStatus,
  SendChannel,
  SendResponse,
} from '@wycenka/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { PRICE_LIST_KEY } from './priceList';

/** Not sent yet – shown with a dashed card on the list. */
export const isDraftStatus = (s: OfferStatus) =>
  s === 'draft' || s === 'ready' || s === 'processing' || s === 'queued';

export const OFFERS_KEY = ['offers'] as const;
export const offerKey = (id: string) => ['offers', id] as const;

export function useOffers() {
  return useQuery({ queryKey: OFFERS_KEY, queryFn: () => api<OfferListItem[]>('/api/offers') });
}

/** Polls every 2 s while the AI is preparing the offer (docs/02 ekran 17). */
export function useOffer(id: string) {
  return useQuery({
    queryKey: offerKey(id),
    queryFn: () => api<OfferDetail>(`/api/offers/${id}`),
    refetchInterval: (q) => (q.state.data?.status === 'processing' ? 2000 : false),
  });
}

/** Every change returns the re-priced offer, which replaces the cached one. */
export function useOfferMutations(id: string) {
  const queryClient = useQueryClient();
  const onSuccess = (offer: OfferDetail) => {
    queryClient.setQueryData(offerKey(id), offer);
    void queryClient.invalidateQueries({ queryKey: OFFERS_KEY, exact: true });
  };
  const call = (path: string, method: string, body?: unknown) =>
    api<OfferDetail>(`/api/offers/${id}${path}`, { method, body });
  const item = (key: string) => `/items/${encodeURIComponent(key)}`;

  return {
    process: useMutation({ mutationFn: () => call('/process', 'POST', {}), onSuccess }),
    answer: useMutation({
      mutationFn: (answers: Record<string, string>) => call('/answers', 'POST', { answers }),
      onSuccess,
    }),
    patch: useMutation({ mutationFn: (patch: OfferPatch) => call('', 'PATCH', patch), onSuccess }),
    geometry: useMutation({
      mutationFn: (input: GeometryInput) => call('/geometry', 'PATCH', input),
      onSuccess,
    }),
    addItem: useMutation({
      mutationFn: (input: AddOfferItemInput) => call('/items', 'POST', input),
      onSuccess,
    }),
    patchItem: useMutation({
      mutationFn: ({ key, patch }: { key: string; patch: OfferItemPatch }) => call(item(key), 'PATCH', patch),
      onSuccess: (offer, { patch }) => {
        onSuccess(offer);
        if (patch.saveToPriceList) void queryClient.invalidateQueries({ queryKey: PRICE_LIST_KEY });
      },
    }),
    removeItem: useMutation({ mutationFn: (key: string) => call(item(key), 'DELETE'), onSuccess }),
    refreshPrices: useMutation({ mutationFn: () => call('/refresh-prices', 'POST', {}), onSuccess }),
    reject: useMutation({ mutationFn: () => call('/reject', 'POST', {}), onSuccess }),
    send: useMutation({
      mutationFn: (channel: SendChannel) =>
        api<SendResponse>(`/api/offers/${id}/send`, { method: 'POST', body: { channel }, keepalive: true }),
      onSuccess: (r) => onSuccess(r.offer),
    }),
  };
}
