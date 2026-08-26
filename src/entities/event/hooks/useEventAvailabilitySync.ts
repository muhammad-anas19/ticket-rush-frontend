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

/**
 * M7's frontend half. Joins `event:{id}`'s room for as long as this hook is mounted, and patches
 * the TanStack cache directly on every update — never triggers a refetch. Per this project's own
 * standing rule: "a socket message that causes an HTTP request has saved nothing — you have paid
 * for a persistent connection and then polled anyway."
 *
 * Only connects while the caller is signed in. The backend's handshake requires SOME valid
 * access token (`TR-DEC-013`) — there is no anonymous WebSocket path today. A logged-out visitor
 * still sees CORRECT availability on every fetch (M4's live merge already guarantees that on the
 * REST side, cache or no cache), just not PUSHED updates without signing in first. Named here as
 * a real, current scope boundary rather than silently assumed away.
 */
export function useEventAvailabilitySync(eventId: string): void {
  const queryClient = useQueryClient();
  const { status } = useSession();

  useEffect(() => {
    if (!eventId || status !== 'authenticated') {
      return;
    }

    const socket = ensureConnected();

    const handleAvailability = (payload: AvailabilityPayload) => {
      // Defensive, not load-bearing today: this hook only ever subscribes to ONE room, but a
      // shared, module-scoped socket could in principle carry listeners for more than one
      // mounted instance, and a stale listener from a previous navigation should never act on a
      // different event's payload.
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

      // Same patch, wherever this event happens to already be sitting in a cached LIST page —
      // covers "viewed the list, opened this event, came back to the list" without forcing that
      // list to refetch. `setQueriesData` matches every cached list regardless of its own
      // page/search/sort params, the same prefix-matching `eventKeys.lists()` already relies on
      // for invalidation elsewhere.
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
