import { api } from '@/shared/api/axiosClient';
import type { PaginatedResponse } from '@/shared/api/types';

import type { CreateEventPayload, Event, EventListParams } from '../model/event.types';

function toParams(params: EventListParams): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
  ) as Record<string, string | number | boolean>;
}

export async function fetchEvents(params: EventListParams = {}): Promise<PaginatedResponse<Event>> {
  return api.get<PaginatedResponse<Event>>('/events', { params: toParams(params) });
}

export async function fetchEvent(id: string): Promise<Event> {
  return api.get<Event>(`/events/${id}`);
}

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
