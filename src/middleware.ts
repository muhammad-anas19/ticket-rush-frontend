import NextAuth from 'next-auth';

import { authConfig } from '@/shared/auth/config';

/**
 * Route protection, running before any rendering.
 *
 * Deliberately built from the SLIM `authConfig` rather than the full config in `shared/auth/index.ts`.
 * Middleware runs in the Edge runtime — no Node APIs, no database drivers — so importing providers or
 * anything reaching for `crypto` risks a build failure or a bloated edge bundle. This is v5's
 * documented split-config pattern.
 *
 * **This is not the security boundary.** It redirects politely and stops the page shell rendering,
 * which is UX. The real boundary is NestJS, which rejects unauthorised requests regardless of what
 * this file decided. Treating a client-side redirect as access control is how "protected" pages ship
 * with publicly fetchable data.
 */
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  /**
   * Skip Next's internals and static assets.
   *
   * `api` is excluded so NextAuth's own routes are not gated by the very middleware that depends on
   * them — leaving that in place is a classic redirect loop.
   */
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
