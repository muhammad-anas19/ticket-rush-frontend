'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { useMyOrders } from '@/entities/order/hooks/useOrders';
import type { OrderStatus } from '@/entities/order/model/order.types';
import { getErrorMessage } from '@/shared/api/errorMessage';
import { formatCents } from '@/shared/lib/money';
import { Badge, Button, Skeleton } from '@/shared/ui';
import type { BadgeTone } from '@/shared/ui';
import styles from './MyOrders.module.scss';

const PAGE_SIZE = 10;

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  pending: 'info',
  paid: 'success',
  failed: 'danger',
  refunded: 'neutral',
};

export function MyOrders() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, isFetching } = useMyOrders({ page, limit: PAGE_SIZE });

  useEffect(() => {
    if (isError) toast.error(getErrorMessage(error), { id: 'my-orders-error' });
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
        <h3>Could not load your orders</h3>
        <p className={styles.errorText}>{getErrorMessage(error)}</p>
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className={styles.empty}>
        <h3>No orders yet</h3>
        <p className={styles.muted}>Hold a ticket and pay for it, and it&apos;ll show up here.</p>
        <Link href="/">
          <Button>Browse events</Button>
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
              <th scope="col">Ordered</th>
              <th scope="col">Qty</th>
              <th scope="col">Amount</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody className={isFetching ? styles.stale : undefined}>
            {data.data.map((order) => {
              const createdAt = new Date(order.createdAt);

              return (
                <tr key={order.id}>
                  <td>
                    {order.event ? (
                      <>
                        <Link href={`/events/${order.event.id}`} className={styles.link}>
                          {order.event.title}
                        </Link>
                        <div className={styles.sub}>{order.event.venue}</div>
                      </>
                    ) : (
                      <span className={styles.muted}>Event unavailable</span>
                    )}
                  </td>
                  <td>
                    <time dateTime={order.createdAt}>
                      {createdAt.toLocaleString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </td>
                  <td>{order.quantity}</td>
                  <td>{formatCents(order.amountCents)}</td>
                  <td>
                    <Badge tone={STATUS_TONE[order.status]}>{order.status}</Badge>
                    {order.status === 'paid' && (
                      <div className={styles.sub}>Ticket generation pending</div>
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
            Page {data.page} of {data.totalPages} · {data.total} orders
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
