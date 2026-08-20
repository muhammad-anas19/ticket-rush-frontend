import { api } from '@/shared/api/axiosClient';
import type { PaginatedResponse } from '@/shared/api/types';

import type { CreateEventPayload, Event, EventListParams } from '../model/event.types';

/** Strips undefined so axios does not serialise `?search=undefined`. */
function toParams(params: EventListParams): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
  ) as Record<string, string | number | boolean>;
}

export async function fetchEvents(params: EventListParams = {}): Promise<PaginatedResponse<Event>> {
  // NOT `api.get<Event[]>`. The backend's envelope wraps a PaginatedResponse, so `data` is the whole
  // pagination object — `{ data, total, page, limit, ... }` — and the rows are one level further in.
  return api.get<PaginatedResponse<Event>>('/events', { params: toParams(params) });
}

export async function fetchEvent(id: string): Promise<Event> {
  return api.get<Event>(`/events/${id}`);
}

/** Organiser's own events, including past ones. Requires an organiser token — 403 otherwise. */
export async function fetchMyEvents(
  params: EventListParams = {},
): Promise<PaginatedResponse<Event>> {
  return api.get<PaginatedResponse<Event>>('/events/mine', { params: toParams(params) });
}

export async function createEvent(payload: CreateEventPayload): Promise<Event> {
  return api.post<Event>('/events', payload);
}

export async function updateEvent(
  id: string,
  payload: Partial<CreateEventPayload>,
): Promise<Event> {
  return api.patch<Event>(`/events/${id}`, payload);
}
