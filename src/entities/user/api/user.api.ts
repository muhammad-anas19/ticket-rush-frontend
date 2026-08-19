import { api } from '@/shared/api/axiosClient';

import type { User, UserRole } from '../model/user.types';

export interface RegisterPayload {
  email: string;
  password: string;
  role: UserRole;
}

/**
 * Registration goes through axios; LOGIN does not.
 *
 * That asymmetry is worth understanding rather than tidying away. Login has to run inside NextAuth's
 * `authorize()` callback, because `authorize()` is what produces the session — calling `/auth/login`
 * directly from a form would return tokens NextAuth never learns about, so the user would hold valid
 * credentials and no session.
 *
 * Registration has no such constraint, so `RegisterForm` calls this and *then* `signIn()`.
 *
 * **Register returns only the user — no tokens.** It used to return a pair, and that was a leak: this
 * client cannot use them (NextAuth mints its own session), so they were discarded while remaining a
 * live refresh-token family in the database that nothing would ever revoke. Logout revokes the family
 * of the token it holds, which is the sign-in family — so every signup left one behind for 7 days.
 *
 * The two-step flow does cost one bcrypt hash plus one bcrypt compare (~500ms total across both
 * calls). That is unavoidable and on a once-per-user path.
 */
export async function registerUser(payload: RegisterPayload): Promise<User> {
  return api.post<User>('/auth/register', payload);
}

/** Reads the CURRENT user from the database, not the token's claims. */
export async function fetchMe(): Promise<User> {
  return api.get<User>('/auth/me');
}
