import { api } from '@/shared/api/axiosClient';

import type { CreateHoldPayload, Hold } from '../model/hold.types';

export async function createHold(eventId: string, payload: CreateHoldPayload): Promise<Hold> {
  return api.post<Hold>(`/events/${eventId}/holds`, payload);
}

export async function releaseHold(holdId: string): Promise<void> {
  return api.delete<void>(`/holds/${holdId}`);
}
