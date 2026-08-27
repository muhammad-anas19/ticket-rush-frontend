export interface EventOrganiser {
  id: string;
  email: string;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  venue: string;
  startsAt: string;
  priceCents: number;
  totalTickets: number;
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
  startsAt: string;
  priceCents: number;
  totalTickets: number;
}
