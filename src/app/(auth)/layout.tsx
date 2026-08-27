import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './layout.module.scss';

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
