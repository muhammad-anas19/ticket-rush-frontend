'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

import { getErrorMessage } from '@/shared/api/errorMessage';
import { Badge, Button, Skeleton } from '@/shared/ui';
import { fetchCacheStats } from './api/cacheStats.api';
import styles from './CacheDebugPanel.module.scss';

const POLL_INTERVAL_MS = 5000;

/**
 * M4's frontend deliverable, per `docs/phases.md`: "little visible UI, a small debug panel reading
 * the cache hit ratio." Not a product feature — there is no user this helps — it exists so the
 * number Redis is actually producing is visible while browsing the event list/detail pages that
 * feed it, instead of living only in a terminal running `curl /api/cache/stats`.
 *
 * Polls on its own rather than reacting to the event list's own fetches, because the ratio is a
 * SERVER-wide count (every client hitting this API moves it, not just this tab) — there is no local
 * event this component could hook into that would keep it current.
 */
export function CacheDebugPanel() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['cache', 'stats'],
    queryFn: fetchCacheStats,
    refetchInterval: POLL_INTERVAL_MS,
    // The whole point is a number that moves on its own — pausing that the moment the tab loses
    // focus would make the panel look frozen the instant it's most likely to be glanced at (e.g.
    // switching over from a terminal running curl against the same endpoint).
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (isError) {
      toast.error(getErrorMessage(error), { id: 'cache-stats-error' });
    }
  }, [isError, error]);

  if (isPending) {
    return (
      <aside className={styles.panel} aria-label="Redis cache stats">
        <Skeleton variant="block" height="1em" width="10em" />
      </aside>
    );
  }

  if (isError || !data) {
    return (
      <aside className={styles.panel} aria-label="Redis cache stats">
        <span className={styles.errorText}>Cache stats unavailable</span>
        <Button variant="ghost" size="sm" onClick={() => void refetch()}>
          Retry
        </Button>
      </aside>
    );
  }

  const hitRatioPercent = Math.round(data.hitRatio * 100);

  return (
    <aside className={styles.panel} aria-label="Redis cache stats">
      <span className={styles.label}>M4 · Redis cache</span>
      <Badge tone={hitRatioPercent >= 50 ? 'success' : 'neutral'}>{hitRatioPercent}% hit</Badge>
      <span className={styles.counts}>
        {data.hits} hits / {data.misses} misses
      </span>
    </aside>
  );
}
