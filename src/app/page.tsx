import { Suspense } from 'react';

import { EventList } from '@/widgets/event-list/EventList';
import { SessionPanel } from '@/widgets/session-panel/SessionPanel';
import styles from './page.module.scss';

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>TicketRush</h1>
        <p className={styles.subtitle}>Live event ticketing</p>
      </header>

      {/*
        Suspense is required, not decorative: EventList calls useSearchParams() to read page and search
        from the URL, and in the App Router that needs a boundary or `next build` FAILS. A build-time
        error, so easy to hit for the first time at deploy.
      */}
      <Suspense fallback={null}>
        <EventList />
      </Suspense>

      <SessionPanel />
    </main>
  );
}
