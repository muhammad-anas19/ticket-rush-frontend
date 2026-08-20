/**
 * The canonical `UserRole` definition. Everything else re-exports or imports from here.
 *
 * It lives in `shared/` because of the FSD import rule: `shared` may import from nothing, and both
 * `shared/auth` (the session type) and `entities/user` (the domain model) need this type. If the
 * canonical copy lived in `entities/user`, then `shared/auth` importing it would be an upward import —
 * forbidden, and for a good reason: it would make the lowest layer depend on a higher one.
 *
 * It was previously declared TWICE — once in `shared/auth/types.ts` and once in
 * `entities/user/model/user.types.ts`. Both said the same thing, so nothing broke. That is precisely
 * what makes duplicate types dangerous: they agree right up until someone adds a third role to one of
 * them, and then TypeScript is satisfied while the two halves of the app disagree about what a role is.
 * P1 shipped exactly this bug with a duplicated `User` interface.
 */
export type UserRole = 'organiser' | 'attendee';

/**
 * Runtime list, derived from the type. Useful for validation and for iterating in a UI.
 *
 * `satisfies readonly UserRole[]` rather than a plain annotation: the array keeps its literal tuple type
 * (so it can be narrowed) *and* is checked against `UserRole`. Add a role to the type and forget it
 * here, and this line does not complain — but `isUserRole` below stays honest because it checks
 * membership of this array, so the failure is a runtime rejection rather than a silent pass.
 */
export const USER_ROLES = ['organiser', 'attendee'] as const satisfies readonly UserRole[];

/**
 * Type guard for values arriving from outside TypeScript's knowledge — an API response, a JWT claim, a
 * form field.
 *
 * Worth having because **types erase at runtime**. Declaring `role: UserRole` on a session object does
 * not make it true; it only means the compiler will not warn you. If the backend ever returns a role
 * this frontend has never heard of, every `role === 'organiser'` check silently evaluates false and the
 * user sees an attendee UI with no error anywhere.
 */
export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}
