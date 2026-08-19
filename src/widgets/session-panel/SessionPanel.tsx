'use client';

import { useQuery } from '@tanstack/react-query';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

import { fetchMe } from '@/entities/user/api/user.api';
import { getErrorMessage } from '@/shared/api/errorMessage';
import { Badge, Button, Skeleton } from '@/shared/ui';
import styles from './SessionPanel.module.scss';

/**
 * M1 verification surface. Replaced in M2 by the real event list.
 *
 * It exists to prove the whole chain end to end: NextAuth session → axios Bearer header → an
 * authenticated NestJS endpoint. `/auth/me` is the ideal probe because it is the one route that reads
 * the DATABASE rather than echoing the token's claims, so a 200 here proves the token was genuinely
 * accepted and not merely decoded.
 */
export function SessionPanel() {
  const { data: session, status } = useSession();

  const {
    data: me,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    // Don't fire until a session exists, or the request goes out with no Authorization header and
    // returns a 401 that looks like a bug rather than "not signed in yet".
    enabled: status === 'authenticated',
  });

  /**
   * Surface backend failures as toasts, verbatim.
   *
   * In an effect rather than during render, because `toast.error()` mutates state in a store outside
   * React — calling it in a render body fires on every re-render and produces a stack of duplicates.
   * Keyed by the message so a re-render with the same error replaces rather than stacks.
   *
   * Note the inline error state below is KEPT alongside this. They serve different readers: the toast
   * is transient and announced to a screen reader; the inline state is the persistent record of a
   * region that failed to load, which the three-mandatory-UI-states rule requires. Both show the same
   * unmodified message, so they cannot disagree.
   */
  useEffect(() => {
    if (isError) {
      toast.error(getErrorMessage(error), { id: 'auth-me-error' });
    }
  }, [isError, error]);

  useEffect(() => {
    if (session?.error === 'RefreshTokenError') {
      // The `jwt` callback's own flag, not a backend message — the refresh failed server-side and
      // there is no API response to relay. Written once, here.
      toast.error('Your session could not be refreshed. Please sign in again.', {
        id: 'refresh-error',
      });
    }
  }, [session?.error]);

  // `status === 'loading'` matters more than it looks. On a fresh page load the client genuinely does
  // not know yet whether a session exists — gating on `authenticated` alone flashes a false
  // signed-out state for the instant before it resolves, and redirecting on that bounces logged-in
  // users to the login page intermittently.
  if (status === 'loading') {
    return (
      <div className={styles.panel}>
        <Skeleton variant="block" height="1.5em" width="40%" />
        <Skeleton variant="block" height="2.5em" />
        <Skeleton variant="block" height="2.5em" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3>Not signed in</h3>
        </div>
        <p className={styles.note}>
          Sign in to verify the full chain: NextAuth session → Bearer header → authenticated API call.
        </p>
        <div className={styles.actions}>
          <Link href="/login">
            <Button>Sign in</Button>
          </Link>
          <Link href="/register">
            <Button variant="secondary">Create account</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>Session</h3>
        <Badge tone={me?.role === 'organiser' ? 'info' : 'neutral'}>
          {me?.role ?? session?.user.role ?? '—'}
        </Badge>
      </div>

      {/* The jwt callback flags a failed refresh rather than throwing, so the client can prompt a
          clean re-login instead of surfacing an opaque server error. */}
      {session?.error === 'RefreshTokenError' && (
        <div className={styles.banner} role="alert">
          Your session could not be refreshed. Please sign in again.
        </div>
      )}


      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.key}>session.user.email</span>
          <span className={styles.value}>{session?.user.email ?? '—'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.key}>session.accessToken</span>
          {/* Truncated on purpose. It IS readable here — that is TR-DEC-002, and the whole point of
              showing it is that the tradeoff is visible rather than buried in a doc. */}
          <span className={styles.value}>
            {session?.accessToken ? `${session.accessToken.slice(0, 24)}…` : '—'}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.key}>session.refreshToken</span>
          <span className={styles.value}>
            {/* Always undefined, by design. TR-DEC-018: the session callback never copies it, so it
                stays server-side inside the encrypted cookie. */}
            <Badge tone="success">absent (server-only)</Badge>
          </span>
        </div>
      </div>

      <h3>GET /api/auth/me</h3>
      {isPending && <Skeleton variant="block" height="2.5em" count={2} />}
      {isError && (
        // The backend's exact message. Never rewritten — see shared/api/errorMessage.ts.
        <div className={styles.banner} role="alert">
          {getErrorMessage(error)}
        </div>
      )}
      {me && (
        <div className={styles.rows}>
          <div className={styles.row}>
            <span className={styles.key}>id</span>
            <span className={styles.value}>{me.id}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.key}>email</span>
            <span className={styles.value}>{me.email}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.key}>role</span>
            <span className={styles.value}>{me.role}</span>
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => void signOut({ callbackUrl: '/' })}>
          Sign out
        </Button>
      </div>

      <p className={styles.note}>
        A 200 above proves the token was accepted by NestJS, not merely decoded —{' '}
        <code>/auth/me</code> reads the database rather than echoing the token&apos;s claims.
      </p>
    </div>
  );
}
