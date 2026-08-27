'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

import type { PaginatedResponse } from '@/shared/api/types';
import { ensureConnected } from '@/shared/realtime/socketClient';
import type { Event } from '../model/event.types';
import { eventKeys } from './useEvents';

interface AvailabilityPayload {
  eventId: string;
  ticketsRemaining: number;
  isSoldOut: boolean;
}

export function useEventAvailabilitySync(eventId: string): void {
  const queryClient = useQueryClient();
  const { status } = useSession();

  useEffect(() => {
    if (!eventId || status !== 'authenticated') {
      return;
    }

    const socket = ensureConnected();

    const handleAvailability = (payload: AvailabilityPayload) => {
      if (payload.eventId !== eventId) {
        return;
      }

      queryClient.setQueryData<Event>(eventKeys.detail(eventId), (previous) =>
        previous
          ? {
              ...previous,
              ticketsRemaining: payload.ticketsRemaining,
              isSoldOut: payload.isSoldOut,
            }
          : previous,
      );

      queryClient.setQueriesData<PaginatedResponse<Event>>(
        { queryKey: eventKeys.lists() },
        (previous) =>
          previous
            ? {
                ...previous,
                data: previous.data.map((event) =>
                  event.id === eventId
                    ? {
                        ...event,
                        ticketsRemaining: payload.ticketsRemaining,
                        isSoldOut: payload.isSoldOut,
                      }
                    : event,
                ),
              }
            : previous,
      );
    };

    socket.emit('subscribe:event', { eventId });
    socket.on('availability', handleAvailability);

    return () => {
      socket.emit('unsubscribe:event', { eventId });
      socket.off('availability', handleAvailability);
    };
  }, [eventId, status, queryClient]);
}
