'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useCreateHold, useReleaseHold } from '@/entities/hold/hooks/useHold';
import type { Hold } from '@/entities/hold/model/hold.types';
import { useCreateCheckoutSession } from '@/entities/order/hooks/useOrders';
import { useCountdown } from '@/shared/lib/useCountdown';
import { Badge, Button } from '@/shared/ui';
import styles from './HoldTicket.module.scss';

export interface HoldTicketProps {
  eventId: string;
  isSoldOut: boolean;
}

/**
 * The M3 frontend slice: hold, countdown, release, and the two failure states M3 exists to teach —
 * "someone else won the race" and "your hold ran out" — handled as distinct, worded states rather than
 * a generic error.
 *
 * Local `activeHold` state, not a TanStack query. A hold isn't something this component reads on
 * mount — the backend has no "my current hold on this event" endpoint (a single browser can hold at
 * most one at a time here, so there's nothing to fetch on load), it only exists after THIS component
 * creates one. It stays local to this component's lifetime rather than syncing to the entity cache
 * for that reason: a hold is short-lived UI state about "what happened when I clicked," not shared
 * catalogue data other components need to read.
 */
export function HoldTicket({ eventId, isSoldOut }: HoldTicketProps) {
  const { status } = useSession();
  const [activeHold, setActiveHold] = useState<Hold | null>(null);

  const createHold = useCreateHold(eventId);
  const releaseHold = useReleaseHold();
  const createCheckout = useCreateCheckoutSession();

  const countdown = useCountdown(activeHold?.expiresAt ?? new Date().toISOString());

  // The moment the countdown reaches zero, drop the local hold state. This is a UX cue only — the
  // AUTHORITY on whether the hold is still good is Postgres's `expires_at`, reconciled server-side by
  // the sweeper (M3 backend) and, from M6, RabbitMQ's TTL+DLX. If this client's clock is a few seconds
  // off from the server's, the worst case is showing "expired" a moment early or late; it never
  // fabricates availability the server disagrees with, because every action still round-trips through
  // the API, which re-checks for real.
  useEffect(() => {
    if (activeHold && countdown.isExpired) {
      setActiveHold(null);
    }
  }, [activeHold, countdown.isExpired]);

  if (status !== 'authenticated') {
    return (
      <Link href={`/login?callbackUrl=/events/${eventId}`}>
        <Button disabled={isSoldOut}>{isSoldOut ? 'Sold out' : 'Sign in to hold a ticket'}</Button>
      </Link>
    );
  }

  if (activeHold && !countdown.isExpired) {
    return (
      <div className={styles.activeHold}>
        <div className={styles.countdownRow}>
          <Badge tone={countdown.totalSeconds <= 60 ? 'warning' : 'info'}>
            Held — {countdown.label} left
          </Badge>
        </div>
        <Button
          variant="secondary"
          size="sm"
          isLoading={releaseHold.isPending}
          onClick={() => {
            releaseHold.mutate(activeHold.id);
            // Optimistic on the LOCAL widget only — this just stops showing a countdown for a hold the
            // user chose to give up. It does not assert the release succeeded to anything else; the
            // event's real availability comes back from the invalidated query, not from this component
            // deciding it did.
            setActiveHold(null);
          }}
        >
          Release
        </Button>
        <Button
          size="sm"
          isLoading={createCheckout.isPending}
          onClick={() => {
            createCheckout.mutate(activeHold.id, {
              onSuccess: ({ checkoutUrl }) => {
                // A hard, full-page navigation, deliberately — this is leaving the app entirely for
                // a page Stripe hosts on a different origin. A client-side route change (`router.push`)
                // would be the wrong tool even if it could reach an external origin, because there is
                // nothing about this transition that should preserve React state on the way out.
                window.location.href = checkoutUrl;
              },
            });
          }}
        >
          {createCheckout.isPending ? 'Redirecting…' : 'Pay now'}
        </Button>
      </div>
    );
  }

  return (
    <Button
      isLoading={createHold.isPending}
      disabled={isSoldOut}
      onClick={() => {
        createHold.mutate(
          { quantity: 1 },
          {
            /**
             * `onSuccess` HERE, not just on the hook. The hook's own `onSuccess` (in `useCreateHold`)
             * invalidates the shared event caches — that part is correct regardless of which component
             * triggered it. This second, component-local callback captures the result for local
             * display (the countdown), which is this component's job alone and has no business living
             * in a hook other call sites also use.
             */
            onSuccess: (hold) => setActiveHold(hold),
            /**
             * The 409 is not swallowed as a generic failure — winning or losing the race for the last
             * seat is the CENTRAL fact M3 exists to demonstrate, and a user hitting it here is living
             * the same event M3's backend test proves with 20 concurrent requests. `useCreateHold`
             * already toasts the backend's exact message ("Not enough tickets remaining"); nothing
             * extra is needed here except making sure the button returns to its normal, retryable state
             * — which happens automatically since `activeHold` was never set.
             */
          },
        );
      }}
    >
      {isSoldOut ? 'Sold out' : createHold.isPending ? 'Holding…' : 'Hold a ticket'}
    </Button>
  );
}
