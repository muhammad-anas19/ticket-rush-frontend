'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { useEvents } from '@/entities/event/hooks/useEvents';
import { EventCard } from '@/entities/event/ui/EventCard';
import { getErrorMessage } from '@/shared/api/errorMessage';
import { Button, Input, Skeleton } from '@/shared/ui';
import styles from './EventList.module.scss';

const PAGE_SIZE = 9;

export function EventList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams?.get('page') ?? 1);
  const search = searchParams?.get('search') ?? '';

  const [searchInput, setSearchInput] = useState(search);

  const { data, isPending, isError, error, isFetching } = useEvents({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
  });

  useEffect(() => {
    if (isError) toast.error(getErrorMessage(error), { id: 'events-error' });
  }, [isError, error]);

  const setParams = useCallback(
    (next: { page?: number; search?: string }) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (next.page !== undefined) params.set('page', String(next.page));
      if (next.search !== undefined) {
        if (next.search) params.set('search', next.search);
        else params.delete('search');
        params.set('page', '1');
      }
      router.push(`/?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    if (searchInput === search) return;
    const timer = setTimeout(() => setParams({ search: searchInput }), 400);
    return () => clearTimeout(timer);
  }, [searchInput, search, setParams]);

  return (
    <section className={styles.wrapper}>
      <div className={styles.toolbar}>
        <Input
          label="Search events"
          type="search"
          placeholder="Title or venue…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {isPending && (
        <div className={styles.grid}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} variant="block" height="11em" />
          ))}
        </div>
      )}

      {isError && (
        <div className={styles.empty}>
          <p className={styles.errorText}>{getErrorMessage(error)}</p>
          <Button variant="secondary" onClick={() => router.refresh()}>
            Retry
          </Button>
        </div>
      )}

      {data && data.data.length === 0 && (
        <div className={styles.empty}>
          <h3>{search ? 'No events match that search' : 'No upcoming events'}</h3>
          <p className={styles.muted}>
            {search ? 'Try a different title or venue.' : 'Check back soon.'}
          </p>
          {search && (
            <Button variant="secondary" onClick={() => setSearchInput('')}>
              Clear search
            </Button>
          )}
        </div>
      )}

      {data && data.data.length > 0 && (
        <>
          <div className={`${styles.grid} ${isFetching ? styles.stale : ''}`}>
            {data.data.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>

          <div className={styles.pagination}>
            <Button
              variant="secondary"
              size="sm"
              disabled={!data.hasPreviousPage || isFetching}
              onClick={() => setParams({ page: page - 1 })}
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
              onClick={() => setParams({ page: page + 1 })}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
