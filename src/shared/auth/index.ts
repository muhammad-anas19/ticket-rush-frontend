import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { JWT } from 'next-auth/jwt';

import { authConfig } from './config';
import type { BackendAuthResponse } from './types';

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

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

        // `null` fails the sign-in cleanly as a CredentialsSignin error. THROWING here is the
        // common mistake — it surfaces differently and can leak the message through the error page,
        // and our backend deliberately returns a generic "Invalid email or password" precisely so
        // nothing distinguishes a wrong password from an unregistered address.
        if (!response.ok) {
          return null;
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
