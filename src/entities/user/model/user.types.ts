export type UserRole = 'organiser' | 'attendee';

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
