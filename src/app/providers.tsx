'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';

import { ApiError } from '@/shared/api/ApiError';
import { AuthTokenSync } from './AuthTokenSync';

/**
 * Global providers.
 *
 * `SessionProvider` is what makes `useSession()` work in client components — without it, every call
 * returns null and the UI reports everyone as signed out. Server-side `auth()` needs no provider; it
 * reads the cookie directly.
 *
 * It wraps QueryClientProvider rather than the reverse because the axios request interceptor reads the
 * session to attach the Bearer header, so any query firing must already be inside a session context.
 */
export function Providers({ children }: { children: ReactNode }) {
  // Created inside useState, NOT as a module-level constant.
  //
  // A module-level QueryClient is created once per *server process*, so in SSR it would be
  // shared across every concurrent user's request — one visitor's cached data served to
  // another. useState gives each browser session its own client, created once per mount
  // rather than on every render.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // How long data is considered fresh. Within this window a remount reads the
            // cache with no network request at all. Zero (the default) means every mount
            // refetches, which throws away most of the benefit.
            staleTime: 30_000,

            // How long an unused cache entry survives before eviction. Longer than
            // staleTime: stale data is still worth showing instantly while a refetch runs,
            // which is what makes navigation feel immediate.
            gcTime: 5 * 60_000,

            // Off in development — it fires on every alt-tab and makes the network tab
            // impossible to read while debugging. Worth turning back on for real use.
            refetchOnWindowFocus: false,

            retry: (failureCount, error) => {
              // Don't retry what won't succeed. A 400 or 404 is deterministic; retrying it
              // three times just delays the error the user needs to see. A 401 must not be
              // retried here either — from M1 that is the refresh interceptor's job, and
              // retrying underneath it would fight for the same rotating token.
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
                return false;
              }
              return failureCount < 2;
            },
          },
          mutations: {
            // Never auto-retry a mutation. Unless the endpoint is genuinely idempotent, a
            // retry can create a second hold or charge a second time — and in this app that
            // is not hypothetical.
            retry: false,
          },
        },
      }),
  );

  return (
    /**
     * ─── Session refetch behaviour, chosen deliberately ────────────────────────
     *
     * `refetchOnWindowFocus` defaults to TRUE in NextAuth, which is why switching tabs or windows fired a
     * `/api/auth/session` call. Turned OFF here, for two reasons:
     *
     *   1. Its main historical job — noticing a sign-out in another tab — is already covered. NextAuth
     *      posts to a **BroadcastChannel** on sign-in and sign-out, so other tabs learn about it without
     *      polling on focus.
     *   2. Its remaining job is keeping the access token fresh, and `refetchInterval` does that on a
     *      predictable schedule instead of "whenever the user alt-tabs".
     *
     * `refetchInterval` is 10 minutes against a 15-minute access token, so the token is renewed with
     * ~5 minutes of headroom. Reading the session runs our `jwt` callback, which refreshes the access
     * token when it is close to expiry — so this interval IS the refresh mechanism, not just a poll.
     *
     * The one case this trades away: a laptop that SLEEPS. `setInterval` does not fire while suspended
     * and does not catch up, so a machine waking after 40 minutes has a stale token until the next tick.
     * The interceptor's `getSession()` fallback and the API's 401 both cover it; if that proves annoying
     * in practice, re-enabling focus refetch is a one-word change and this comment is the reason why.
     */
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={10 * 60}>
      <QueryClientProvider client={queryClient}>
        {/* Keeps the axios client's token in step with the session. Renders nothing. */}
        <AuthTokenSync />
        {children}
        {/*
          One Toaster for the whole app. Every failed request surfaces here with the backend's exact
          message — see shared/api/errorMessage.ts for why the frontend never rewrites one.

          Styled from the design tokens rather than react-hot-toast's defaults, which are built for a
          light theme and would sit oddly on a dark surface.

          `ariaProps` matter: role="alert" with aria-live="assertive" means a screen reader announces
          the failure immediately. A toast that only appears visually is invisible to the users most
          likely to need the message.
        */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 5000,
            style: {
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              fontSize: '0.875em',
              maxWidth: '32em',
            },
            error: {
              // Longer than a success toast. An error is something the user has to read and act on,
              // and 4 seconds is not enough to read a validation message and understand it.
              duration: 7000,
              iconTheme: { primary: 'var(--color-danger)', secondary: 'var(--color-surface)' },
              ariaProps: { role: 'alert', 'aria-live': 'assertive' },
            },
            success: {
              iconTheme: { primary: 'var(--color-success)', secondary: 'var(--color-surface)' },
            },
          }}
        />
      </QueryClientProvider>
    </SessionProvider>
  );
}
