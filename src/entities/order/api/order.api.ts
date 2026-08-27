import { api } from '@/shared/api/axiosClient';
import type { PaginatedResponse } from '@/shared/api/types';

import type { Order, OrderListParams } from '../model/order.types';

function toParams(params: OrderListParams): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined),
  ) as Record<string, string | number>;
}

export async function createCheckoutSession(
  holdId: string,
): Promise<{ checkoutUrl: string; orderId: string }> {
  return api.post<{ checkoutUrl: string; orderId: string }>(`/holds/${holdId}/checkout`);
}

export async function fetchOrder(id: string): Promise<Order> {
  return api.get<Order>(`/orders/${id}`);
}

export async function fetchMyOrders(
  params: OrderListParams = {},
): Promise<PaginatedResponse<Order>> {
  return api.get<PaginatedResponse<Order>>('/orders/mine', { params: toParams(params) });
}
