'use client';

import { useEffect, useState } from 'react';

export interface Countdown {
  totalSeconds: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  label: string;
}

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
