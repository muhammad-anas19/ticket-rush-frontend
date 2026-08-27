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
      void queryClient.invalidateQueries({ queryKey: eventKeys.details() });
      void queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

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
