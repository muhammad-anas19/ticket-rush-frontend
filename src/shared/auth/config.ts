import type { NextAuthConfig } from 'next-auth';

/**
 * The slim half of the split config.
 *
 * v5's documented pattern: middleware runs in the **Edge runtime**, which has no Node APIs and no
 * database drivers. Importing the full config there — providers, adapters, anything that reaches for
 * `crypto` or a driver — either fails to build or silently bloats the edge bundle.
 *
 * So this file holds only what middleware needs (the `authorized` callback and page routes), and
 * `index.ts` composes it with the providers for use everywhere else. Our Credentials provider only
 * uses `fetch`, so it would probably survive the edge — but following the split keeps that an
 * accident rather than a dependency.
 */
export const authConfig = {
  pages: {
    // Our own login page rather than NextAuth's default. Unauthenticated visitors to a protected
    // route land here with a `?callbackUrl=` so they return to where they were headed.
    signIn: '/login',
    error: '/login',
  },

  session: {
    // Forced, not chosen: the Credentials provider does not support the `database` strategy at all,
    // because NextAuth does not manage our users — they live in Postgres behind NestJS, so there is
    // no adapter-managed user record for a session row to point at.
    //
    // The cost is no server-side revocation: this cookie is self-contained and valid until it
    // expires. Same staleness property as a stateless access token, one layer up.
    strategy: 'jwt',
    // Matches the backend's refresh-token lifetime. Longer would leave a session whose refresh
    // token is already dead — the user appears logged in and every API call fails.
    maxAge: 7 * 24 * 60 * 60,
  },

  callbacks: {
    /**
     * A VIEW over the decoded token. Lives in the SLIM config, and that placement is the fix for a real
     * bug rather than a stylistic choice.
     *
     * Middleware builds NextAuth from this file alone. When this callback lived only in the full config,
     * the middleware's `auth.user` had NO `role` — NextAuth fell back to its default session shape
     * (name/email/image). So the organiser gate read `auth?.user?.role !== 'organiser'` as
     * `undefined !== 'organiser'` → true, and **every organiser was redirected away from
     * `/organiser/*`.** The gate worked perfectly; it was just reading a field that did not exist there.
     *
     * The lesson generalises beyond this project: with a split config, **anything that shapes the
     * session must live in the half that middleware also loads**, or the session means different things
     * in different places. That divergence is silent — no error, no warning, just a missing field.
     *
     * Safe on the Edge because it is pure object mapping: no Node APIs, no drivers, no fetch.
     *
     * Note precisely what crosses this boundary and what does not:
     *   accessToken  → exposed (TR-DEC-002), bounded by a 15-minute lifetime.
     *   refreshToken → NOT exposed (TR-DEC-018). It stays in the JWT, server-side only.
     * Adding one line here would turn a bounded XSS incident into a 7-day account takeover.
     */
    session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },

    /**
     * Used by middleware to decide whether to allow a request.
     *
     * Note what this is NOT: a security boundary. It stops the page shell rendering and redirects
     * politely, which is UX. The real boundary is the API — NestJS rejects unauthorised requests
     * regardless of what the frontend rendered. Treating a client-side redirect as access control is
     * how "protected" pages ship with publicly fetchable data.
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isAuthPage = ['/login', '/register'].includes(nextUrl.pathname);

      /**
       * Already signed in and heading for login/register: send them home.
       *
       * Note this returns an explicit `Response.redirect` rather than `false`, and that distinction
       * cost a debugging round. Returning `false` means "not authorised", and NextAuth's response to
       * that is to redirect to `pages.signIn` — which IS `/login`. Redirecting `/login` to `/login`
       * is a loop, so NextAuth short-circuits it and renders the page anyway. The check appeared to
       * do nothing.
       *
       * `false` means "bounce them to the login page". When the desired destination is anywhere
       * else, say so explicitly. The callback's return type is `boolean | Response` precisely so
       * this is expressible.
       */
      if (isAuthPage && isLoggedIn) {
        return Response.redirect(new URL('/', nextUrl));
      }

      /**
       * Organiser-only route prefix.
       *
       * Returning `false` here IS correct — unlike the auth-page case above — because `false` means
       * "send them to `pages.signIn`", and bouncing an unauthenticated visitor to the login page is
       * exactly the desired behaviour. NextAuth appends `?callbackUrl=` so they land back here after
       * signing in.
       */
      if (nextUrl.pathname.startsWith('/organiser')) {
        if (!isLoggedIn) {
          return false;
        }

        /**
         * Signed in but the wrong role. Redirect home rather than to login — sending them to a login
         * page they are already past is a dead end that reads as a broken app.
         *
         * NOTE the role here comes from the session cookie, so it can be up to one access-token
         * lifetime stale. That is acceptable for a redirect (worst case an ex-organiser sees a form
         * whose submit 403s) and would NOT be acceptable as the only check — which is why the API
         * enforces it independently.
         */
        if (auth?.user?.role !== 'organiser') {
          return Response.redirect(new URL('/', nextUrl));
        }

        return true;
      }

      // Everything else is public: browsing events requires no account.
      return true;
    },
  },

  // Providers are added in index.ts, not here — see the file comment.
  providers: [],
} satisfies NextAuthConfig;
