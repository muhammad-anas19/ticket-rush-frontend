'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';

import { ApiError } from '@/shared/api/ApiError';
import { AuthTokenSync } from './AuthTokenSync';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,

            gcTime: 5 * 60_000,

            refetchOnWindowFocus: false,

            retry: (failureCount, error) => {
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
                return false;
              }
              return failureCount < 2;
            },
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      <QueryClientProvider client={queryClient}>
        <AuthTokenSync />
        {children}
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
