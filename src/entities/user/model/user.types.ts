// Re-exported so consumers can keep importing the role from the user entity, while exactly one
// definition exists. `shared` owns it because the FSD rule forbids `shared/auth` importing upward from
// `entities`.
export type { UserRole } from '@/shared/model/roles';
import type { UserRole } from '@/shared/model/roles';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'attendee', label: 'Attendee — browse events and buy tickets' },
  { value: 'organiser', label: 'Organiser — publish events and sell tickets' },
];
