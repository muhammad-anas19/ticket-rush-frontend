'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { setAccessToken } from '@/shared/api/axiosClient';

export function AuthTokenSync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') return;

    setAccessToken(session?.accessToken ?? null, session?.accessTokenExpiresAt ?? 0);
  }, [session?.accessToken, session?.accessTokenExpiresAt, status]);

  return null;
}
