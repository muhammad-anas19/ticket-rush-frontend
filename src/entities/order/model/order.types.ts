export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface OrderEventSummary {
  id: string;
  title: string;
  venue: string;
  startsAt: string;
}

export interface Order {
  id: string;
  eventId: string;
  quantity: number;
  amountCents: number;
  status: OrderStatus;
  createdAt: string;
  event?: OrderEventSummary;
}

export interface OrderListParams {
  page?: number;
  limit?: number;
}
