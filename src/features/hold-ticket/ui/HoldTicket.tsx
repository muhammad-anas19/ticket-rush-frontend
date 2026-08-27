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

export function HoldTicket({ eventId, isSoldOut }: HoldTicketProps) {
  const { status } = useSession();
  const [activeHold, setActiveHold] = useState<Hold | null>(null);

  const createHold = useCreateHold(eventId);
  const releaseHold = useReleaseHold();
  const createCheckout = useCreateCheckoutSession();

  const countdown = useCountdown(activeHold?.expiresAt ?? new Date().toISOString());

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
            onSuccess: (hold) => setActiveHold(hold),
          },
        );
      }}
    >
      {isSoldOut ? 'Sold out' : createHold.isPending ? 'Holding…' : 'Hold a ticket'}
    </Button>
  );
}
