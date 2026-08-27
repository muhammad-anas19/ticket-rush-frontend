import Link from 'next/link';

import { Badge } from '@/shared/ui';
import { formatCents } from '@/shared/lib/money';
import type { Event } from '../model/event.types';
import styles from './EventCard.module.scss';

export interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  const startsAt = new Date(event.startsAt);

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
        <span className={styles.price}>{formatCents(event.priceCents)}</span>
        <span className={styles.meta}>
          {event.ticketsCommitted}/{event.totalTickets} committed
        </span>
      </div>
    </Link>
  );
}
