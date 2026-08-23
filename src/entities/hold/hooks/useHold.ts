'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { eventKeys } from '@/entities/event/hooks/useEvents';
import { getErrorMessage } from '@/shared/api/errorMessage';
import { createHold, releaseHold } from '../api/hold.api';
import type { CreateHoldPayload } from '../model/hold.types';

export function useCreateHold(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateHoldPayload) => createHold(eventId, payload),
    onSuccess: () => {
      /**
       * Invalidate rather than `setQueryData` with a locally-computed remaining count.
       *
       * The response DOES carry `eventTicketsRemaining`, and it would be cheap to patch the cached
       * event with it directly. Not done here on purpose: this hold was ONE winner among however many
       * concurrent attempts just raced for the same seats (that race is the entire point of M3), and
       * this response only knows the count immediately after ITS OWN write. Patching the cache with a
       * value that was already possibly stale by the time this response arrived would be confidently
       * wrong in exactly the scenario this project is built to get right. Invalidating asks the server
       * for the current truth instead of asserting a snapshot.
       */
      void queryClient.invalidateQueries({ queryKey: eventKeys.details() });
      void queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
    },
    // The backend's exact message — a 409 already reads "Not enough tickets remaining", which is
    // exactly what a user needs to hear when they lost the race. Never rewritten; see
    // shared/api/errorMessage.ts for why substituting local wording would be the wrong instinct here.
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// No eventId parameter, unlike useCreateHold — releasing only ever needs the hold's own id, and the
// cache invalidation below is intentionally broad (every event list and detail) rather than scoped to
// one event, so there's nothing here that an eventId would narrow.
export function useReleaseHold() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (holdId: string) => releaseHold(holdId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.details() });
      void queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      toast.success('Hold released');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
