import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { JWT } from 'next-auth/jwt';

import { authConfig } from './config';
import type { BackendAuthResponse } from './types';

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Carries the backend's own error message out of `authorize()` and back to the login form.
 *
 * This exists because of a real limitation: `authorize()` returning `null` produces a generic
 * `CredentialsSignin` error and the backend's message is DISCARDED. NextAuth deliberately does not
 * forward arbitrary text from a credentials check to the client.
 *
 * The one channel it does provide is `CredentialsSignin.code`, which is placed in the redirect URL's
 * `code` query parameter and — with `redirect: false` — comes back as `result.code` from `signIn()`.
 *
 * Auth.js warns that `code` ends up in a URL and so must not hint at anything sensitive. That
 * warning is satisfied here for a specific reason rather than by luck: the backend already returns a
 * deliberately generic "Invalid email or password" for both a wrong password and an unregistered
 * address, and it burns an equivalent bcrypt comparison on the unknown-email path so response timing
 * cannot distinguish them either. We are forwarding a message that has already been sanitised by the
 * party that owns that decision.
 *
 * Which is the whole point of doing it this way: the frontend does not get a vote on what is safe to
 * say. It relays.
 */
class BackendCredentialsError extends CredentialsSignin {
  constructor(public code: string) {
    super(code);
  }
}

/**
 * Exchanges an expired access token for a fresh pair.
 *
 * Runs SERVER-SIDE, inside the `jwt` callback, because per TR-DEC-018 the refresh token never
 * reaches the browser — client JavaScript could not do this even if it wanted to.
 *
 * ─── The race this is exposed to, and why it is survivable ───────────────────
 *
 * Several server components can read the session at once. If the access token has just expired, the
 * `jwt` callback fires in each of them and each lands here with the same refresh token. One wins;
 * the backend rotates and marks the old token spent. The others then present a spent token — which,
 * against a backend with reuse detection, looks exactly like theft and would revoke the whole family,
 * hard-signing-out a completely legitimate user.
 *
 * The browser fix does not transfer. In a single tab you would deduplicate with a module-level
 * in-flight promise, because every caller shares one heap. Here the callback runs on the server and
 * may execute in DIFFERENT PROCESSES under serverless or multi-instance deployment — a module-level
 * promise dedupes within a process, not across them.
 *
 * So the fix lives on the backend instead: a 30-second grace window (TR-DEC-017) accepts a
 * just-rotated token and returns a valid pair, making refresh effectively idempotent inside the
 * window. Verified: five concurrent refreshes all return 200.
 *
 * The same mechanism also covers the lost-response case — client refreshes, server commits, the
 * response never arrives, the client retries with a token the server already spent. Indistinguishable
 * from theft on the wire, which is precisely why the window exists.
 */
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const response = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token.refreshToken }),
      // Never cache an auth call. Next.js caches fetch aggressively by default, and a cached
      // refresh response would replay a spent token — straight into reuse detection.
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Refresh failed with ${response.status}`);
    }

    const envelope = (await response.json()) as { data: BackendAuthResponse };
    const data = envelope.data;

    return {
      ...token,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      accessTokenExpiresAt: data.accessTokenExpiresAt,
      error: undefined,
    };
  } catch {
    /**
     * Returning a token marked with an error rather than throwing.
     *
     * Throwing here would break the session read entirely and surface as an opaque server error.
     * Flagging it instead lets the session callback pass `error` to the client, which can then
     * prompt a clean re-login. The stale tokens are deliberately left in place — they are already
     * useless, and clearing them would make the failure indistinguishable from "never signed in".
     */
    return { ...token, error: 'RefreshTokenError' };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      // Declared for NextAuth's own default sign-in form, which we do not use — our login page is
      // a React Hook Form + Yup form calling signIn() directly. Kept because the shape also
      // documents what authorize() receives.
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },

      /**
       * A thin HTTP client over the backend's login endpoint — which is the point.
       *
       * NextAuth's docs discourage the Credentials provider because it usually means you are storing
       * and verifying passwords yourself, and most teams get that wrong. That concern is aimed at
       * people implementing the check *inside* this function. Here, bcrypt verification, timing
       * parity against user enumeration, and the users table all live in NestJS. **NextAuth never
       * sees a password hash.**
       *
       * What does still apply: we own the entire password lifecycle and NextAuth helps with none of
       * it. It is doing session-cookie management, not identity.
       */
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const response = await fetch(`${API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
          cache: 'no-store',
        });

        if (!response.ok) {
          // Throwing a CredentialsSignin subclass rather than returning `null`.
          //
          // `null` is the documented way to fail, and it is correct when you have nothing to say —
          // but it throws the backend's message away. Since the requirement is that the user sees
          // the API's exact wording, the message is attached as `code` and read back from
          // `signIn()`'s result.
          //
          // Note this is NOT the "throwing leaks information" mistake: the leak risk is throwing an
          // arbitrary Error, whose message Auth.js may surface on its own error page. A
          // CredentialsSignin subclass is the supported path, and `code` is the field designed to
          // cross that boundary.
          const body = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new BackendCredentialsError(body?.message ?? 'Sign-in failed');
        }

        const envelope = (await response.json()) as { data: BackendAuthResponse };
        const data = envelope.data;

        // Whatever is returned here arrives in the `jwt` callback as `user` — and ONLY on that
        // first call. Anything not copied onto `token` there is gone forever.
        return {
          id: data.user.id,
          email: data.user.email,
          role: data.user.role,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          accessTokenExpiresAt: data.accessTokenExpiresAt,
        };
      },
    }),
  ],

  /**
   * ─── Server-side revocation on sign-out ──────────────────────────────────────
   *
   * This exists because of a real bug found by checking the database after signing out.
   *
   * `signOut()` clears NextAuth's session cookie and nothing more. It knows nothing about our
   * backend, so the refresh-token family stayed **live in Postgres for its full 7 days**. Verified:
   * after sign-out the session endpoint returned `null` while `SELECT count(*) ... WHERE revoked_at
   * IS NULL` still returned 2.
   *
   * So "logging out" only logged out of this browser. Anyone else holding that refresh token could
   * still mint access tokens for a week — which is exactly the failure mode logout is supposed to
   * prevent, and precisely the P1 bug this project's notes warn about: logout appeared to work and
   * never revoked anything server-side.
   *
   * `events.signOut` receives the decoded token for JWT sessions, which is the only place the
   * refresh token is still reachable at sign-out time.
   */
  events: {
    async signOut(message) {
      // Union type: `{ token }` for JWT sessions, `{ session }` for database sessions. We are always
      // the former (the Credentials provider forces it), but narrow rather than assume.
      if (!('token' in message) || !message.token?.refreshToken) {
        return;
      }

      try {
        await fetch(`${API}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: message.token.refreshToken }),
          cache: 'no-store',
        });
      } catch {
        /**
         * Deliberately swallowed. Throwing here would break the sign-out flow and leave the user
         * with a session cookie they asked to be rid of — trading a definite local failure for a
         * possible remote one.
         *
         * The backend's logout is idempotent (an unknown token still returns 200), so a retry is
         * safe, and the tokens expire on their own regardless. The residual risk if this call is
         * lost is the original bug for up to 7 days, which is why a periodic sweep of expired and
         * orphaned tokens is on the M8 list.
         */
      }
    },
  },

  callbacks: {
    ...authConfig.callbacks,

    /**
     * STORAGE. Runs server-side whenever the token is created or updated: once at sign-in with
     * `user` populated, then on every session read as the cookie is decoded and re-encoded.
     *
     * The return value is what gets encrypted into the cookie.
     */
    async jwt({ token, user }) {
      // Sign-in — the only call where `user` exists.
      if (user) {
        return {
          ...token,
          id: user.id!,
          role: user.role!,
          accessToken: user.accessToken!,
          refreshToken: user.refreshToken!,
          accessTokenExpiresAt: user.accessTokenExpiresAt!,
        };
      }

      // Refresh 30 seconds EARLY rather than exactly at expiry. Without the skew, a request that
      // passes this check can still arrive at the API with a token that expired in flight — and
      // clock drift between this host and the API makes that likelier than it sounds.
      if (Date.now() < token.accessTokenExpiresAt - 30_000) {
        return token;
      }

      return refreshAccessToken(token);
    },

    /**
     * A VIEW. Runs whenever the session is read — `auth()`, `useSession()`, `getSession()`.
     *
     * Note precisely what crosses this boundary and what does not:
     *   accessToken   → exposed. TR-DEC-002, bounded by a 15-minute lifetime.
     *   refreshToken  → NOT exposed. TR-DEC-018. It stays in the token above, server-side only.
     *
     * That asymmetry is the entire reason `jwt` and `session` are separate functions. Adding one
     * line here would turn a bounded XSS incident into a 7-day account takeover.
     */
    session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
});
