import { redirect } from 'next/navigation';

import { CreateEventForm } from '@/features/create-event/ui/CreateEventForm';
import { auth } from '@/shared/auth';
import styles from './page.module.scss';

export const metadata = { title: 'New event · TicketRush' };

/**
 * A SERVER component, using `auth()` rather than `useSession()`.
 *
 * The gate happens before any HTML is produced, so an attendee never receives the form markup at all —
 * better than rendering it and hiding it client-side.
 *
 * Note what this is NOT: the security boundary. That is `POST /api/events`, which NestJS protects with
 * RolesGuard regardless of what the frontend rendered. This check is UX — it saves an attendee from
 * filling in a form that would 403 on submit. Treating a client-side redirect as access control is how
 * "protected" pages ship with publicly reachable data.
 */
export default async function NewEventPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login?callbackUrl=/organiser/events/new');
  }

  if (session.user.role !== 'organiser') {
    redirect('/');
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Create an event</h1>
        <p className={styles.subtitle}>
          Price is entered in dollars and stored as integer cents. The start time is entered in your local
          timezone and stored as a UTC instant.
        </p>
      </header>

      <div className={styles.card}>
        <CreateEventForm />
      </div>
    </main>
  );
}
