'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { setAccessToken } from '@/shared/api/axiosClient';

/**
 * Pushes the session's access token into the axios client whenever it changes.
 *
 * Renders nothing. It exists so the request interceptor can read the token **synchronously** instead of
 * calling `getSession()` — which is a real, uncached `fetch` to `/api/auth/session` on every single call.
 *
 * `useSession()` reads from `SessionProvider`'s in-memory cache, so this costs no network request of its
 * own. The provider is the single thing that fetches the session; everything else reads its copy. That
 * is the whole point: **one owner of the session, many readers.**
 *
 * Must be rendered INSIDE `SessionProvider`, or `useSession()` returns null and the token is never set.
 */
export function AuthTokenSync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    // Wait for the provider to resolve. Clearing the token on 'loading' would blank it on every mount and
    // send the first request of each page unauthenticated.
    if (status === 'loading') return;

    // Explicitly null on sign-out. Leaving a stale token in module scope would keep attaching a dead
    // credential to requests — 401s that look like a backend problem.
    // Expiry passed alongside the token so the interceptor can decide whether it is still usable
    // WITHOUT spending a request to find out. Omitting it was Bug 2 in axiosClient.ts: the client held
    // a token it could not evaluate, so an expired one was used until a timer happened to fire.
    setAccessToken(session?.accessToken ?? null, session?.accessTokenExpiresAt ?? 0);
  }, [session?.accessToken, session?.accessTokenExpiresAt, status]);

  return null;
}
