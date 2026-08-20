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

  /**
   * Page and search live in the URL, not in component state.
   *
   * That is the state-ownership rule, and it buys three concrete things: the URL is shareable, browser
   * back/forward work as the user expects, and a refresh keeps you where you were. Holding page number
   * in `useState` throws all three away for no benefit.
   */
  const page = Number(searchParams?.get('page') ?? 1);
  const search = searchParams?.get('search') ?? '';

  // Local mirror so typing feels instant, debounced into the URL below. Two pieces of state for one
  // value is a real cost — justified only because writing to the URL on every keystroke would push a
  // history entry per character and fire a request per character.
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
        // Any change to the filter must reset to page 1. Without this, searching while on page 7 asks for
        // page 7 of a smaller result set and shows an empty list — which reads as "no results" when there
        // are plenty.
        params.set('page', '1');
      }
      router.push(`/?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Debounced search. 400ms is long enough that a normal typist produces one request per word rather
  // than per letter, and short enough not to feel laggy.
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

      {/* State 1 — loading. Skeletons shaped like the real cards, never a full-page spinner. */}
      {isPending && (
        <div className={styles.grid}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} variant="block" height="11em" />
          ))}
        </div>
      )}

      {/* State 2 — error. The backend's exact message, plus a retry. */}
      {isError && (
        <div className={styles.empty}>
          <p className={styles.errorText}>{getErrorMessage(error)}</p>
          <Button variant="secondary" onClick={() => router.refresh()}>
            Retry
          </Button>
        </div>
      )}

      {/* State 3 — empty. Distinguishes "no events exist" from "your search matched nothing", because
          those need different actions from the user. */}
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

            {/*
              Page numbers and a total are only possible because we chose OFFSET pagination. Keyset would
              be constant-time at any depth but could offer neither — no page count without a separate
              COUNT(*), and no jumping. Worth the trade while the dataset is small; the note in
              pagination-query.dto.ts records where that stops being true.
            */}
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
