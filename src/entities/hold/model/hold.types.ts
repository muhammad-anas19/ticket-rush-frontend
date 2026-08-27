export type HoldStatus = 'active' | 'converted' | 'expired';

export interface Hold {
  id: string;
  eventId: string;
  quantity: number;
  status: HoldStatus;
  expiresAt: string;
  eventTicketsRemaining: number;
}

export interface CreateHoldPayload {
  quantity: number;
}
