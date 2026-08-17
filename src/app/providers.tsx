'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { ApiError } from '@/shared/api/ApiError';

/**
 * Global providers. M1 adds NextAuth's SessionProvider around this one.
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

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
