export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface OrderEventSummary {
  id: string;
  title: string;
  venue: string;
  /** ISO 8601 UTC. */
  startsAt: string;
}

export interface Order {
  id: string;
  eventId: string;
  quantity: number;
  /** Integer minor units. 1999 means $19.99. Never divide by 100 outside `formatCents`. */
  amountCents: number;
  /**
   * The one field worth polling after a Stripe redirect. Set only by the webhook — never by
   * anything the browser does — which is the entire reason polling this is meaningful and
   * trusting the Checkout redirect on its own is not.
   */
  status: OrderStatus;
  createdAt: string;
  /** Present on the "my orders" list (a JOIN); absent on the single-order poll. */
  event?: OrderEventSummary;
}

export interface OrderListParams {
  page?: number;
  limit?: number;
}
