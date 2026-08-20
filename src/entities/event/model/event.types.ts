export interface EventOrganiser {
  id: string;
  email: string;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  venue: string;
  /** ISO 8601 UTC string. Convert with `new Date()` at the render boundary, never before. */
  startsAt: string;
  /** Integer minor units. 1999 means $19.99. Never divide by 100 outside `formatCents`. */
  priceCents: number;
  totalTickets: number;
  /** Held OR sold — a hold is a reservation, not a sale. */
  ticketsCommitted: number;
  ticketsRemaining: number;
  isSoldOut: boolean;
  organiser?: EventOrganiser;
  createdAt: string;
}

export type EventSortBy = 'startsAt' | 'priceCents' | 'createdAt' | 'title';

export interface EventListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: EventSortBy;
  sortOrder?: 'ASC' | 'DESC';
  upcomingOnly?: boolean;
}

export interface CreateEventPayload {
  title: string;
  description?: string;
  venue: string;
  /** ISO 8601 with an explicit offset or Z. A bare local string makes the server guess the zone. */
  startsAt: string;
  priceCents: number;
  totalTickets: number;
}
