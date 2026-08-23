'use client';

import { useEffect, useState } from 'react';

export interface Countdown {
  totalSeconds: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  /** `"9:47"` — always two digits on the seconds side. */
  label: string;
}

/**
 * A countdown to a server-supplied deadline.
 *
 * The one rule this hook exists to enforce: **the deadline is the server's `expiresAt`, a fixed point
 * in time — never a duration counted down in the client.** The naive version starts from "10 minutes"
 * and decrements a local counter once a second. Two real things break it:
 *
 *   1. **Clock skew.** If this device's clock disagrees with the server's by even a few seconds, a
 *      locally-counted "10:00 remaining" can expire before or after the hold actually does — and the
 *      one case that matters is showing time remaining on a hold Postgres has already released.
 *   2. **Backgrounded tabs.** Browsers throttle `setInterval` in inactive tabs — sometimes to once a
 *      minute, sometimes to a full stop. A counter that decrements per tick LOSES time while
 *      backgrounded; a value recomputed from a fixed deadline does not, because the next tick (whenever
 *      it actually fires) recalculates from `Date.now()` against the same unmoving target.
 *
 * So every tick here recomputes `expiresAt - Date.now()` from scratch. The deadline never moves; only
 * the "now" side of the subtraction does. Waking a suspended tab after ten minutes shows "expired"
 * immediately, correctly, rather than a counter that silently paused and needs to catch up.
 */
export function useCountdown(expiresAtIso: string): Countdown {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const deadline = new Date(expiresAtIso).getTime();
  const remainingMs = Math.max(0, deadline - now);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return {
    totalSeconds,
    minutes,
    seconds,
    isExpired: remainingMs <= 0,
    label: `${minutes}:${String(seconds).padStart(2, '0')}`,
  };
}
