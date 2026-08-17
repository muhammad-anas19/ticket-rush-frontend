import { api } from '@/shared/api/axiosClient';

import type { User, UserRole } from '../model/user.types';

export interface RegisterPayload {
  email: string;
  password: string;
  role: UserRole;
}

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
}

/**
 * Registration goes through axios; LOGIN does not.
 *
 * That asymmetry is worth understanding rather than tidying away. Login has to run inside NextAuth's
 * `authorize()` callback, because `authorize()` is what produces the session — calling
 * `/auth/login` directly from a form would return tokens that NextAuth never learns about, so the
 * user would hold valid credentials and no session.
 *
 * Registration has no such constraint: the backend returns a token pair, and we then call `signIn()`
 * with the same credentials so NextAuth establishes the session properly. That means the password is
 * verified twice on the backend — two bcrypt comparisons, ~500ms total. Accepted deliberately: the
 * alternative is a second NextAuth provider that trusts pre-issued tokens, which is more machinery
 * and a wider trust surface for one extra hash on a once-per-user path.
 */
export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/register', payload);
}

/** Reads the CURRENT user from the database, not the token's claims. */
export async function fetchMe(): Promise<User> {
  return api.get<User>('/auth/me');
}
