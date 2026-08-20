import type { DefaultSession } from 'next-auth';

// Re-exported, not redeclared. Canonical definition: shared/model/roles.ts — see that file for why a
// duplicated type is dangerous even while both copies agree.
import type { UserRole } from '../model/roles';

export type { UserRole };

/** What the backend's /auth/login and /auth/register return. */
export interface BackendAuthResponse {
  user: {
    id: string;
    email: string;
    role: UserRole;
    createdAt: string;
  };
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
}

/**
 * Module augmentation — the only way to add fields to NextAuth's own types.
 *
 * Without this, `session.accessToken` is a TypeScript error and `token.refreshToken` is `unknown`.
 * NextAuth's types are deliberately minimal so that whatever you choose to carry is explicit
 * rather than `any`.
 *
 * Note this is a *compile-time* contract only. TypeScript erases at runtime, so declaring
 * `accessToken: string` does not make it exist — that is the `jwt` callback's job. The type says
 * what we intend; the callback is what makes it true.
 */
declare module 'next-auth' {
  /**
   * What `auth()` and `useSession()` return.
   *
   * `accessToken` is here (TR-DEC-002: readable by client JS, bounded by a 15-minute lifetime).
   * `refreshToken` is deliberately ABSENT (TR-DEC-018) — it lives only in the JWT below, which
   * stays server-side inside the encrypted cookie. A stolen access token is a bounded incident; a
   * stolen 7-day refresh token is an account takeover.
   */
  interface Session {
    accessToken?: string;
    error?: 'RefreshTokenError';
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession['user'];
  }

  /** What `authorize()` returns, flowing into the `jwt` callback as `user`. */
  interface User {
    id?: string;
    email?: string | null;
    role?: UserRole;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
  }
}

declare module 'next-auth/jwt' {
  /**
   * What is encrypted into the session cookie. STORAGE, not a view.
   *
   * `refreshToken` is here and never copied into `Session` — that asymmetry is the whole reason the
   * `jwt` and `session` callbacks are separate functions.
   */
  interface JWT {
    id: string;
    role: UserRole;
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: number;
    error?: 'RefreshTokenError';
  }
}
