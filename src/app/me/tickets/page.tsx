import { redirect } from 'next/navigation';

import { auth } from '@/shared/auth';
import { MyOrders } from '@/widgets/my-orders/MyOrders';
import styles from './page.module.scss';

export const metadata = { title: 'My tickets · TicketRush' };

/**
 * A SERVER component so the wrong (unauthenticated) audience never receives the markup — same
 * reasoning `organiser/events/page.tsx` documents for its own gate. Not the security boundary
 * either way: `GET /api/orders/mine` is scoped to the caller's own `userId` server-side
 * regardless of what rendered here.
 */
export default async function MyTicketsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login?callbackUrl=/me/tickets');
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>My tickets</h1>
        <p className={styles.subtitle}>Every order you&apos;ve placed, across every event.</p>
      </header>

      <MyOrders />
    </main>
  );
}
