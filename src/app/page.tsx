'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

import { Badge, Button, Skeleton } from '@/shared/ui';
import styles from './page.module.scss';

/**
 * M0 verification page. Its only job is to prove the wiring works end to end: SCSS tokens,
 * atoms, TanStack Query, and a real call reaching the NestJS backend across a CORS boundary.
 *
 * It hits /health/ready directly rather than through `shared/api`, because health lives
 * OUTSIDE the /api prefix and returns Terminus's own shape rather than the envelope — so the
 * envelope-unwrapping client would look for a `.data.data` that isn't there. That mismatch is
 * itself the M0 lesson about which routes are exempt from the global contract.
 *
 * Deleted in M2 when there are real events to show.
 */

interface HealthResult {
  status: 'ok' | 'error' | 'shutting_down';
  details: Record<string, { status: 'up' | 'down'; message?: string }>;
}

const HEALTH_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/api$/, '') + '/health/ready';

export default function HomePage() {
  const { data, isPending, isError, error, refetch, isFetching } = useQuery<HealthResult>({
    queryKey: ['health', 'ready'],
    queryFn: async () => {
      // validateStatus so a 503 resolves instead of throwing — an unhealthy dependency is a
      // result we want to render, not a query failure. A genuine network error still rejects.
      const response = await axios.get<HealthResult>(HEALTH_URL, {
        validateStatus: (status) => status === 200 || status === 503,
      });
      return response.data;
    },
    refetchInterval: 10_000,
  });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>TicketRush</h1>
        <p className={styles.subtitle}>Module 0 — foundation. Backend reachable, wiring verified.</p>
      </header>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h3>Backend readiness</h3>
          <Button size="sm" variant="secondary" onClick={() => void refetch()} isLoading={isFetching}>
            Refresh
          </Button>
        </div>

        {/* The three mandatory states. Loading first — a skeleton shaped like the real
            content, never a spinner. */}
        {isPending && (
          <div className={styles.checks}>
            <Skeleton variant="block" height="2.5em" />
            <Skeleton variant="block" height="2.5em" />
          </div>
        )}

        {isError && (
          <div className={styles.error}>
            <p>Could not reach the API.</p>
            <p className={styles.hint}>
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
            <p className={styles.hint}>
              Is the backend running on :3001, and does its CORS_ORIGIN allow :3000?
            </p>
          </div>
        )}

        {data && (
          <div className={styles.checks}>
            {Object.entries(data.details).map(([name, detail]) => (
              <div key={name} className={styles.check}>
                <span className={styles.checkName}>{name}</span>
                {/* Text carries the meaning; colour only reinforces it. */}
                <Badge tone={detail.status === 'up' ? 'success' : 'danger'}>
                  {detail.status === 'up' ? 'up' : (detail.message ?? 'down')}
                </Badge>
              </div>
            ))}

            {/* RabbitMQ is deliberately absent from readiness — see the health controller.
                Saying so here stops it reading as a missing check. */}
            <div className={styles.check}>
              <span className={styles.checkName}>rabbitmq</span>
              <Badge tone="neutral">not in readiness (by design)</Badge>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
