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

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: (holdId: string) => createCheckoutSession(holdId),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

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
