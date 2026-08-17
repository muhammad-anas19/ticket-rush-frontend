import { handlers } from '@/shared/auth';

/**
 * NextAuth's own endpoints: /api/auth/signin, /callback, /session, /csrf, /signout.
 *
 * The path is fixed by Next.js — a catch-all route handler is how NextAuth serves itself, so this one
 * file cannot be moved into an FSD layer. The *configuration* lives in `shared/auth/`, and this is a
 * two-line re-export, which keeps the FSD violation to "a framework-mandated file exists where the
 * framework mandates it".
 *
 * `NextAuth()` returns `handlers` as an object, so the route handlers have to be destructured out of
 * it rather than re-exported by name — a route file must export functions literally called GET and
 * POST for Next.js to find them.
 *
 * Note these are the NEXT app's routes on port 3000, not the NestJS API's `/api/auth/*` on 3001. Two
 * different `/api/auth` namespaces on two different origins — worth keeping straight when reading a
 * network tab.
 */
export const { GET, POST } = handlers;
