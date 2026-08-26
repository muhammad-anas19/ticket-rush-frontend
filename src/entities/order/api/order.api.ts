import { api } from '@/shared/api/axiosClient';
import type { PaginatedResponse } from '@/shared/api/types';

import type { Order, OrderListParams } from '../model/order.types';

function toParams(params: OrderListParams): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined),
  ) as Record<string, string | number>;
}

/** Starts (or resumes) payment for a held ticket. Redirect the browser to the returned URL. */
export async function createCheckoutSession(
  holdId: string,
): Promise<{ checkoutUrl: string; orderId: string }> {
  return api.post<{ checkoutUrl: string; orderId: string }>(`/holds/${holdId}/checkout`);
}

/** Owner-only poll target after a Checkout redirect — never trust the redirect itself. */
export async function fetchOrder(id: string): Promise<Order> {
  return api.get<Order>(`/orders/${id}`);
}

/** `/me/tickets`'s data source. */
export async function fetchMyOrders(
  params: OrderListParams = {},
): Promise<PaginatedResponse<Order>> {
  return api.get<PaginatedResponse<Order>>('/orders/mine', { params: toParams(params) });
}
