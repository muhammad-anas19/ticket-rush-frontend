import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './layout.module.scss';

/**
 * Shared shell for /login and /register.
 *
 * A route GROUP — the parentheses mean `(auth)` does not appear in the URL. It exists purely to give
 * these two pages a common layout without nesting them under an `/auth/` path.
 *
 * No auth check here: middleware already redirects signed-in visitors away from these routes, and
 * duplicating the check would mean two places to keep in agreement.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Link href="/">
            <h1>TicketRush</h1>
          </Link>
          <p className={styles.tagline}>Live event ticketing</p>
        </div>
        {children}
      </div>
    </div>
  );
}
