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
      void queryClient.invalidateQueries({ queryKey: eventKeys.all });
      toast.success(`"${event.title}" created`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateEvent(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<CreateEventPayload>) => updateEvent(id, payload),
    onSuccess: (event) => {
      queryClient.setQueryData(eventKeys.detail(id), event);
      void queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      toast.success('Event updated');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
