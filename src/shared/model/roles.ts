export type UserRole = 'organiser' | 'attendee';

export const USER_ROLES = ['organiser', 'attendee'] as const satisfies readonly UserRole[];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}
