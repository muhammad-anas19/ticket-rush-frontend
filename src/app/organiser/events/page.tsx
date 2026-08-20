import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/shared/auth';
import { Button } from '@/shared/ui';
import { MyEvents } from '@/widgets/my-events/MyEvents';
import styles from './page.module.scss';

export const metadata = { title: 'My events · TicketRush' };

/**
 * A SERVER component, so the wrong role never receives the markup.
 *
 * This duplicates the middleware gate deliberately: middleware matches by pattern and is easy to
 * mis-scope, so a page that must not render for the wrong role says so itself. One line, and it is the
 * last defence before HTML exists.
 *
 * Neither check is the security boundary — `GET /api/events/mine` is guarded by RolesGuard and returns
 * 403 regardless of what rendered.
 */
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
