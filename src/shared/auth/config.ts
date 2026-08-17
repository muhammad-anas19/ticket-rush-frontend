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

      // Everything else is public in M1. M2 adds organiser-only routes here — and returning `false`
      // for those IS correct, because sending an unauthenticated visitor to the login page is
      // exactly what should happen.
      return true;
    },
  },

  // Providers are added in index.ts, not here — see the file comment.
  providers: [],
} satisfies NextAuthConfig;
