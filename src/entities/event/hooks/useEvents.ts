'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { getErrorMessage } from '@/shared/api/errorMessage';
import {
  createEvent,
  fetchEvent,
  fetchEvents,
  fetchMyEvents,
  updateEvent,
} from '../api/event.api';
import type { CreateEventPayload, EventListParams } from '../model/event.types';

/**
 * Query keys in ONE place, as a const object.
 *
 * This is the correction P1 made late and this project starts with. When keys are written inline at
 * each call site, an invalidation eventually uses a slightly different key from the query it means to
 * invalidate — and the failure is silent: the mutation succeeds, the list just doesn't update, and it
 * looks like a caching bug rather than a typo.
 *
 * The hierarchy matters. `invalidateQueries({ queryKey: eventKeys.lists() })` invalidates every list
 * regardless of its params, because TanStack Query matches key PREFIXES. So one call covers page 1,
 * page 7, and every search term without enumerating them.
 */
export const eventKeys = {
  all: ['events'] as const,
  lists: () => [...eventKeys.all, 'list'] as const,
  list: (params: EventListParams) => [...eventKeys.lists(), params] as const,
  mine: (params: EventListParams) => [...eventKeys.all, 'mine', params] as const,
  details: () => [...eventKeys.all, 'detail'] as const,
  detail: (id: string) => [...eventKeys.details(), id] as const,
};

export function useEvents(params: EventListParams = {}) {
  return useQuery({
    queryKey: eventKeys.list(params),
    queryFn: () => fetchEvents(params),
    // Keeps the previous page visible while the next one loads, instead of flashing a skeleton on every
    // page change. Without it, paginating feels like the whole list reloads.
    placeholderData: (previous) => previous,
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: eventKeys.detail(id),
    queryFn: () => fetchEvent(id),
    enabled: Boolean(id),
  });
}

export function useMyEvents(params: EventListParams = {}) {
  return useQuery({
    queryKey: eventKeys.mine(params),
    queryFn: () => fetchMyEvents(params),
    placeholderData: (previous) => previous,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateEventPayload) => createEvent(payload),
    onSuccess: (event) => {
      // Prefix matching: invalidates every cached list and every "mine" page in one call, because they
      // all start with ['events'].
      void queryClient.invalidateQueries({ queryKey: eventKeys.all });
      toast.success(`"${event.title}" created`);
    },
    // The backend's exact message, never a substituted one — see shared/api/errorMessage.ts.
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateEvent(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<CreateEventPayload>) => updateEvent(id, payload),
    onSuccess: (event) => {
      // Write the fresh row straight into the detail cache so the page updates immediately, then
      // invalidate the lists so their (now stale) copies refetch. `setQueryData` avoids a round trip for
      // data the server just handed us.
      queryClient.setQueryData(eventKeys.detail(id), event);
      void queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      toast.success('Event updated');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
