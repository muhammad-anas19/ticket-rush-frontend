'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Badge, Button } from '@/shared/ui';
import styles from './SiteHeader.module.scss';

/**
 * The only navigation in the app. Until now the sole route into `/organiser/*` was a button buried in
 * the session panel on the home page — so "how do I see my events" had no answer, because there was no
 * link to follow.
 *
 * A client component because it reads the session to decide what to show. `useSession()` reads
 * `SessionProvider`'s in-memory cache, so this costs no network request.
 */
export function SiteHeader() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const isOrganiser = session?.user.role === 'organiser';

  return (
    <header className={styles.header}>
      <nav className={styles.nav} aria-label="Main">
        <Link href="/" className={styles.brand}>
          TicketRush
        </Link>

        <div className={styles.links}>
          {/* aria-current tells assistive technology which page you are on — the visual highlight
              alone communicates nothing to a screen reader. */}
          <Link
            href="/"
            className={pathname === '/' ? styles.active : styles.link}
            aria-current={pathname === '/' ? 'page' : undefined}
          >
            Events
          </Link>

          {/* Any signed-in user, not just attendees — an organiser can hold and pay for a
              ticket too, to their own or someone else's event. Gated on the session existing,
              same non-security reasoning as the organiser links below: the page itself redirects
              a signed-out visitor regardless of whether this link was ever shown. */}
          {status === 'authenticated' && (
            <Link
              href="/me/tickets"
              className={pathname === '/me/tickets' ? styles.active : styles.link}
              aria-current={pathname === '/me/tickets' ? 'page' : undefined}
            >
              My tickets
            </Link>
          )}

          {/*
            Organiser-only links.

            Gated on the session role so we do not offer routes that would redirect. This is NOT
            security — middleware redirects and `RolesGuard` returns 403 regardless. It is only about
            not showing a link that leads nowhere.
          */}
          {isOrganiser && (
            <>
              <Link
                href="/organiser/events"
                className={pathname === '/organiser/events' ? styles.active : styles.link}
                aria-current={pathname === '/organiser/events' ? 'page' : undefined}
              >
                My events
              </Link>
              <Link
                href="/organiser/events/new"
                className={pathname === '/organiser/events/new' ? styles.active : styles.link}
                aria-current={pathname === '/organiser/events/new' ? 'page' : undefined}
              >
                New event
              </Link>
            </>
          )}
        </div>
      </nav>

      <div className={styles.account}>
        {/*
          `status === 'loading'` gets its own branch rather than falling through to "signed out".
          Without it the header flashes Sign in / Create account on every page load for a user who is
          in fact signed in — brief, and exactly the kind of flicker that reads as a broken app.
        */}
        {status === 'loading' && <span className={styles.muted}>…</span>}

        {status === 'unauthenticated' && (
          <>
            <Link href="/login">
              <Button size="sm" variant="secondary">
                Sign in
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Create account</Button>
            </Link>
          </>
        )}

        {status === 'authenticated' && (
          <>
            <Badge tone={isOrganiser ? 'info' : 'neutral'}>{session.user.role}</Badge>
            <span className={styles.email}>{session.user.email}</span>
            <Button size="sm" variant="ghost" onClick={() => void signOut({ callbackUrl: '/' })}>
              Sign out
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
