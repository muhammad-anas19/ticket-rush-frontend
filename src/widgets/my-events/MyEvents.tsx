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
      <div className={styles.tableScroll}>
        <table className={styles.table}>
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
