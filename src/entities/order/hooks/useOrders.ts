'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { getErrorMessage } from '@/shared/api/errorMessage';
import { createCheckoutSession, fetchMyOrders, fetchOrder } from '../api/order.api';
import type { OrderListParams } from '../model/order.types';

export const orderKeys = {
  all: ['orders'] as const,
  mine: (params: OrderListParams) => [...orderKeys.all, 'mine', params] as const,
  detail: (id: string) => [...orderKeys.all, 'detail', id] as const,
};

/**
 * Starts (or resumes) a Stripe Checkout Session. `onSuccess` is left to the CALLER — the correct
 * next step is a hard, full-page redirect to `checkoutUrl` (Stripe's own hosted page, a different
 * origin entirely), not anything a hook should decide silently on every call site's behalf.
 */
export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: (holdId: string) => createCheckoutSession(holdId),
    // The backend's exact message, never rewritten — see shared/api/errorMessage.ts. A 409
    // ("already paid for") or 403 ("no longer active") both read correctly as-is.
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

/**
 * Polls `GET /api/orders/:id` while the order is still `pending` — the frontend's half of
 * "the success page cannot be trusted, only the webhook decides." Stops polling the instant the
 * order leaves `pending`, since `paid`/`failed`/`refunded` are all terminal: nothing server-side
 * will ever move this order again once the webhook has acted.
 */
export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => fetchOrder(id),
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 2000 : false),
  });
}

export function useMyOrders(params: OrderListParams = {}) {
  return useQuery({
    queryKey: orderKeys.mine(params),
    queryFn: () => fetchMyOrders(params),
    placeholderData: (previous) => previous,
  });
}
