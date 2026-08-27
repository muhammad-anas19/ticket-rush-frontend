import { redirect } from 'next/navigation';

import { CreateEventForm } from '@/features/create-event/ui/CreateEventForm';
import { auth } from '@/shared/auth';
import styles from './page.module.scss';

export const metadata = { title: 'New event · TicketRush' };

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
