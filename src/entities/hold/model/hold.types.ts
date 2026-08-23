export type HoldStatus = 'active' | 'converted' | 'expired';

export interface Hold {
  id: string;
  eventId: string;
  quantity: number;
  status: HoldStatus;
  /** ISO 8601 UTC. The countdown deadline. Always trust THIS over any client-side clock. */
  expiresAt: string;
  eventTicketsRemaining: number;
}

export interface CreateHoldPayload {
  quantity: number;
}
