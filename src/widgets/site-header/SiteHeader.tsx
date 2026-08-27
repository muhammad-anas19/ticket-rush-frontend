'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Badge, Button } from '@/shared/ui';
import styles from './SiteHeader.module.scss';

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
          <Link
            href="/"
            className={pathname === '/' ? styles.active : styles.link}
            aria-current={pathname === '/' ? 'page' : undefined}
          >
            Events
          </Link>

          {status === 'authenticated' && (
            <Link
              href="/me/tickets"
              className={pathname === '/me/tickets' ? styles.active : styles.link}
              aria-current={pathname === '/me/tickets' ? 'page' : undefined}
            >
              My tickets
            </Link>
          )}

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
