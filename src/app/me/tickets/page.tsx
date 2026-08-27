import { redirect } from 'next/navigation';

import { auth } from '@/shared/auth';
import { MyOrders } from '@/widgets/my-orders/MyOrders';
import styles from './page.module.scss';

export const metadata = { title: 'My tickets · TicketRush' };

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
