'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { useMyEvents } from '@/entities/event/hooks/useEvents';
import { getErrorMessage } from '@/shared/api/errorMessage';
import { formatCents } from '@/shared/lib/money';
import { Badge, Button, Skeleton } from '@/shared/ui';
import styles from './MyEvents.module.scss';

const PAGE_SIZE = 10;

/**
 * The organiser's own events, from `GET /api/events/mine`.
 *
 * Deliberately a table rather than the public `EventCard` grid, because the job is different: an
 * attendee is browsing and needs the event to look appealing, an organiser is managing and needs to
 * compare capacity and sales across rows. Reusing the card here would have been "sharing a component"
 * at the cost of the thing each view is actually for.
 *
 * This endpoint differs from the public one in two ways worth noticing:
 *   - It includes PAST events. The public listing hides them (`upcomingOnly` defaults true), but an
 *     organiser reviewing what they have run needs them.
 *   - It requires the organiser role. `RolesGuard` returns 403 to an attendee regardless of what the
 *     UI rendered — this component never has to be the gate.
 */
export function MyEvents() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, isFetching } = useMyEvents({
    page,
    limit: PAGE_SIZE,
  });

  useEffect(() => {
    if (isError) toast.error(getErrorMessage(error), { id: 'my-events-error' });
  }, [isError, error]);

  if (isPending) {
    return (
      <div className={styles.wrapper}>
        <Skeleton variant="block" height="3em" count={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.empty}>
        <h3>Could not load your events</h3>
        {/* The backend's exact message. A 403 here would say "Insufficient permissions for this
            action" — already the right words, chosen once, on the server. */}
        <p className={styles.errorText}>{getErrorMessage(error)}</p>
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className={styles.empty}>
        <h3>You have not created any events yet</h3>
        <p className={styles.muted}>Publish one and it will appear here.</p>
        <Link href="/organiser/events/new">
          <Button>Create your first event</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {/* Scrolls inside its own container so the page body never scrolls sideways on a narrow screen. */}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          {/* Real semantic table markup — <th scope> lets a screen reader announce which column a
              cell belongs to. A grid of divs reads as an undifferentiated wall of text. */}
          <thead>
            <tr>
              <th scope="col">Event</th>
              <th scope="col">Starts</th>
              <th scope="col">Price</th>
              <th scope="col">Committed</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody className={isFetching ? styles.stale : undefined}>
            {data.data.map((event) => {
              const startsAt = new Date(event.startsAt);
              const isPast = startsAt.getTime() < Date.now();
              const pct = Math.round((event.ticketsCommitted / event.totalTickets) * 100);

              return (
                <tr key={event.id}>
                  <td>
                    <Link href={`/events/${event.id}`} className={styles.link}>
                      {event.title}
                    </Link>
                    <div className={styles.sub}>{event.venue}</div>
                  </td>
                  <td>
                    {/* Viewer's timezone, from a stored UTC instant. */}
                    <time dateTime={event.startsAt}>
                      {startsAt.toLocaleString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </td>
                  <td>{formatCents(event.priceCents)}</td>
                  <td>
                    {event.ticketsCommitted}/{event.totalTickets}
                    <div className={styles.sub}>{pct}% committed</div>
                  </td>
                  <td>
                    {/* Text carries the meaning; colour only reinforces it. */}
                    {isPast ? (
                      <Badge tone="neutral">Past</Badge>
                    ) : event.isSoldOut ? (
                      <Badge tone="danger">Sold out</Badge>
                    ) : (
                      <Badge tone="success">On sale</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.totalPages > 1 && (
        <div className={styles.pagination}>
          <Button
            variant="secondary"
            size="sm"
            disabled={!data.hasPreviousPage || isFetching}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className={styles.muted}>
            Page {data.page} of {data.totalPages} · {data.total} events
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={!data.hasNextPage || isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
