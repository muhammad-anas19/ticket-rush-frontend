import Link from 'next/link';

import { Badge } from '@/shared/ui';
import { formatCents } from '@/shared/lib/money';
import type { Event } from '../model/event.types';
import styles from './EventCard.module.scss';

export interface EventCardProps {
  event: Event;
}

/**
 * Lives in `entities/event/ui` because it renders one domain object and nothing else — no data fetching,
 * no business action. That is what makes it reusable by the public list, the organiser dashboard, and
 * anything later. A component that fetched its own data would belong in `widgets`.
 */
export function EventCard({ event }: EventCardProps) {
  const startsAt = new Date(event.startsAt);

  // Availability tone: a soft warning below 10% left. Colour is never the only signal — the number is
  // always there in text, because a red badge and a green one are identical to roughly one in twelve men.
  const scarce = !event.isSoldOut && event.ticketsRemaining <= event.totalTickets * 0.1;

  return (
    <Link href={`/events/${event.id}`} className={`${styles.card} ${event.isSoldOut ? styles.soldOut : ''}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>{event.title}</h3>
        {event.isSoldOut ? (
          <Badge tone="danger">Sold out</Badge>
        ) : (
          <Badge tone={scarce ? 'warning' : 'success'}>{event.ticketsRemaining} left</Badge>
        )}
      </div>

      <div className={styles.meta}>
        <span>{event.venue}</span>
        {/*
          Rendered with `toLocaleString`, which formats in the VIEWER's timezone.

          The server stores a UTC instant (TIMESTAMPTZ) and sends an ISO 8601 string with a Z, so this is
          the one correct place to convert. An event at 20:00 in Karachi shows as 16:00 to a London
          viewer — the same instant, rendered locally. Formatting on the server instead would bake one
          timezone into the response and be wrong for everyone else.
        */}
        <time dateTime={event.startsAt}>
          {startsAt.toLocaleString(undefined, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </div>

      <div className={styles.footer}>
        {/* formatCents is the only thing allowed to divide by 100. */}
        <span className={styles.price}>{formatCents(event.priceCents)}</span>
        <span className={styles.meta}>
          {event.ticketsCommitted}/{event.totalTickets} committed
        </span>
      </div>
    </Link>
  );
}
