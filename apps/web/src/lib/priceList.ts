import type {
  PriceListEntry,
  PriceListItemInput,
  PriceListItemPatch,
  PriceListResponse,
  PricingRuleInput,
  PricingRuleKind,
} from '@wycenka/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const PRICE_LIST_KEY = ['price-list'] as const;

export function usePriceList() {
  return useQuery({ queryKey: PRICE_LIST_KEY, queryFn: () => api<PriceListResponse>('/api/price-list') });
}

/** Mutations update the cached list so both layouts show the change immediately. */
export function usePriceListMutations() {
  const queryClient = useQueryClient();
  const setList = (update: (list: PriceListResponse) => PriceListResponse) =>
    queryClient.setQueryData<PriceListResponse>(PRICE_LIST_KEY, (old) => (old ? update(old) : old));

  const create = useMutation({
    mutationFn: (input: PriceListItemInput) =>
      api<PriceListEntry>('/api/price-list/items', { method: 'POST', body: input }),
    onSuccess: (item) => setList((l) => ({ ...l, items: [...l.items, item] })),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PriceListItemPatch }) =>
      api<PriceListEntry>(`/api/price-list/items/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: (item) => setList((l) => ({ ...l, items: l.items.map((i) => (i.id === item.id ? item : i)) })),
  });

  const archive = useMutation({
    mutationFn: (id: string) => api<null>(`/api/price-list/items/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) =>
      setList((l) => ({
        ...l,
        items: l.items.filter((i) => i.id !== id),
        recentFromOffers: l.recentFromOffers.filter((r) => r.itemId !== id),
      })),
  });

  const saveRule = useMutation({
    mutationFn: ({ kind, input }: { kind: PricingRuleKind; input: PricingRuleInput }) =>
      api<PriceListResponse>(`/api/price-list/rules/${kind}`, { method: 'PUT', body: input }),
    onSuccess: (list) => queryClient.setQueryData(PRICE_LIST_KEY, list),
  });

  return { create, update, archive, saveRule };
}
