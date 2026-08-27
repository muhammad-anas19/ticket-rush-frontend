import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/shared/auth';
import { Button } from '@/shared/ui';
import { MyEvents } from '@/widgets/my-events/MyEvents';
import styles from './page.module.scss';

export const metadata = { title: 'My events · TicketRush' };

export default async function MyEventsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login?callbackUrl=/organiser/events');
  }

  if (session.user.role !== 'organiser') {
    redirect('/');
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>My events</h1>
          <p className={styles.subtitle}>
            Includes past events, unlike the public listing.
          </p>
        </div>
        <Link href="/organiser/events/new">
          <Button>New event</Button>
        </Link>
      </header>

      <MyEvents />
    </main>
  );
}
