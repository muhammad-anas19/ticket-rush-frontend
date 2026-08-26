'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

import { useEventAvailabilitySync } from '@/entities/event/hooks/useEventAvailabilitySync';
import { useEvent } from '@/entities/event/hooks/useEvents';
import { HoldTicket } from '@/features/hold-ticket/ui/HoldTicket';
import { getErrorMessage } from '@/shared/api/errorMessage';
import { formatCents } from '@/shared/lib/money';
import { Badge, Button, Skeleton } from '@/shared/ui';
import styles from './EventDetail.module.scss';

export function EventDetail({ id }: { id: string }) {
  const { data: event, isPending, isError, error } = useEvent(id);

  // M7: joins `event:{id}`'s room for as long as this page is mounted, patching the cache
  // directly on every push — called unconditionally (before the loading/error early returns)
  // because it's a hook, and safely a no-op until `useEvent`'s own cache entry actually exists.
  useEventAvailabilitySync(id);

  useEffect(() => {
    if (isError) toast.error(getErrorMessage(error), { id: `event-${id}` });
  }, [isError, error, id]);

  if (isPending) {
    return (
      <main className={styles.page}>
        <Skeleton variant="text" width="8em" />
        <Skeleton variant="block" height="18em" />
      </main>
    );
  }

  if (isError || !event) {
    return (
      <main className={styles.page}>
        <div className={styles.errorBox}>
          <h3>Could not load this event</h3>
          {/* The backend's exact message. A 404 already says "Event not found" — the right text, written
              once, on the server. */}
          <p className={styles.errorText}>{getErrorMessage(error)}</p>
          <Link href="/">
            <Button variant="secondary">Back to events</Button>
          </Link>
        </div>
      </main>
    );
  }

  const startsAt = new Date(event.startsAt);

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>
        ← All events
      </Link>

      <article className={styles.card}>
        <div className={styles.header}>
          <h1>{event.title}</h1>
          {event.isSoldOut ? (
            <Badge tone="danger">Sold out</Badge>
          ) : (
            <Badge tone="success">{event.ticketsRemaining} left</Badge>
          )}
        </div>

        {event.description && <p className={styles.description}>{event.description}</p>}

        <div className={styles.rows}>
          <div className={styles.row}>
            <span className={styles.key}>Venue</span>
            <span>{event.venue}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.key}>Starts</span>
            {/*
              Rendered in the VIEWER's timezone from a UTC instant. `dateStyle: 'full'` is deliberately
              verbose here: on a detail page the user is deciding whether they can attend, and an
              ambiguous time is worse than a wordy one.
            */}
            <time dateTime={event.startsAt}>
              {startsAt.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}
            </time>
          </div>
          <div className={styles.row}>
            <span className={styles.key}>Availability</span>
            <span>
              {event.ticketsRemaining} of {event.totalTickets} · {event.ticketsCommitted} committed
            </span>
          </div>
          {event.organiser && (
            <div className={styles.row}>
              <span className={styles.key}>Organiser</span>
              <span>{event.organiser.email}</span>
            </div>
          )}
        </div>

        <div className={styles.header}>
          <span className={styles.price}>{formatCents(event.priceCents)}</span>
          <HoldTicket eventId={event.id} isSoldOut={event.isSoldOut} />
        </div>

        <p className={styles.note}>
          &ldquo;Committed&rdquo; counts tickets held <em>or</em> sold — a hold is a reservation, not a
          sale. This number is read live from Postgres and is deliberately <strong>not</strong> cached in
          M4: a stale title is cosmetic, a stale availability count is a correctness bug, because someone
          acts on it.
        </p>
      </article>
    </main>
  );
}
