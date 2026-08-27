import { Suspense } from 'react';

import { EventList } from '@/widgets/event-list/EventList';
import styles from './page.module.scss';

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>TicketRush</h1>
        <p className={styles.subtitle}>Live event ticketing</p>
      </header>

      <Suspense fallback={null}>
        <EventList />
      </Suspense>
    </main>
  );
}
