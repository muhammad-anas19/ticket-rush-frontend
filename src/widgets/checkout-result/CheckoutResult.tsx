'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

import { useOrder } from '@/entities/order/hooks/useOrders';
import { getErrorMessage } from '@/shared/api/errorMessage';
import { formatCents } from '@/shared/lib/money';
import { Badge, Button, Skeleton } from '@/shared/ui';
import styles from './CheckoutResult.module.scss';

export function CheckoutResult() {
  const orderId = useSearchParams()?.get('orderId');
  const { data: order, isPending, isError, error } = useOrder(orderId ?? '');

  useEffect(() => {
    if (isError) toast.error(getErrorMessage(error), { id: `order-${orderId}` });
  }, [isError, error, orderId]);

  if (!orderId) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1>Missing order reference</h1>
          <p className={styles.muted}>If you completed a payment, check My tickets instead.</p>
          <div className={styles.actions}>
            <Link href="/me/tickets">
              <Button>My tickets</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (isPending) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <Skeleton variant="text" width="10em" />
          <Skeleton variant="block" height="4em" />
        </div>
      </main>
    );
  }

  if (isError || !order) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1>Could not check your order</h1>
          <p className={styles.errorText}>{getErrorMessage(error)}</p>
          <div className={styles.actions}>
            <Link href="/">
              <Button variant="secondary">Back to events</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (order.status === 'pending') {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <span className={styles.icon} aria-hidden="true">
            ⏳
          </span>
          <h1>Confirming your payment…</h1>
          <p className={styles.muted}>
            Stripe told your browser to come here — that only means a payment was ATTEMPTED, not
            that it succeeded. This page is waiting for our server to hear back from Stripe
            directly, which is the only thing that actually decides this.
          </p>
        </div>
      </main>
    );
  }

  if (order.status === 'paid') {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <span className={styles.icon} aria-hidden="true">
            ✅
          </span>
          <h1>Payment confirmed</h1>
          <Badge tone="success">{formatCents(order.amountCents)} paid</Badge>
          <p className={styles.muted}>
            {order.quantity} ticket{order.quantity === 1 ? '' : 's'}
            {order.event ? <> for {order.event.title}</> : null}. Your ticket will appear on{' '}
            <Link href="/me/tickets">My tickets</Link> once it&apos;s generated — that happens a
            moment after payment, not instantly, since it&apos;s handled asynchronously.
          </p>
          <div className={styles.actions}>
            <Link href="/me/tickets">
              <Button>View my tickets</Button>
            </Link>
            <Link href="/">
              <Button variant="secondary">Back to events</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (order.status === 'refunded') {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <span className={styles.icon} aria-hidden="true">
            ↩️
          </span>
          <h1>Refunded</h1>
          <p className={styles.muted}>
            Your payment went through, but the seat was gone by the time it was confirmed — your
            hold had expired and someone else took it first. You were not charged; a refund has
            been issued.
          </p>
          <div className={styles.actions}>
            <Link href={`/events/${order.eventId}`}>
              <Button>View the event</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <span className={styles.icon} aria-hidden="true">
          ❌
        </span>
        <h1>Payment failed</h1>
        <p className={styles.muted}>Your card was not charged. You can try again.</p>
        <div className={styles.actions}>
          <Link href={`/events/${order.eventId}`}>
            <Button>Try again</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
