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

/**
 * `frontend/CLAUDE.md`'s standing rule, taken literally: "the Stripe success page cannot be
 * trusted... poll or subscribe for the order's real status rather than asserting success." This
 * component never assumes payment succeeded because the browser landed here — Stripe's
 * `success_url` proves only that a browser was POINTED somewhere, not that money moved. Only
 * `order.status`, set exclusively by the webhook, decides what's shown.
 *
 * `useOrder()` polls every 2s while `status === 'pending'` and stops the instant it isn't —
 * `pending` is the ONLY non-terminal state; `paid`/`failed`/`refunded` never change again once
 * the webhook has acted, so there is nothing left to ask about after that.
 *
 * Reads `?orderId=` itself (`OrdersService.createCheckoutSession()`'s `success_url` query param
 * — there ONLY so this page knows which order to poll, never trusted as proof of anything by
 * itself) rather than taking it as a prop, so the page composing this stays a plain server
 * component — the same split `widgets/event-list/EventList.tsx` already uses.
 */
export function CheckoutResult() {
  const orderId = useSearchParams()?.get('orderId');
  // `enabled: Boolean(id)` inside `useOrder` itself already no-ops the query for a missing id —
  // this hook call must still happen unconditionally, before any early return, same as every
  // other hook here.
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
          {/* The backend's exact message — never rewritten. */}
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

  // 'failed'
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
