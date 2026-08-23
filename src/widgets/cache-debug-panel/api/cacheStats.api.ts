import { api } from '@/shared/api/axiosClient';

import type { CacheStats } from '../model/cacheStats.types';

/**
 * `@Public()` on the backend — no Bearer token required, deliberately: the whole point is being
 * able to glance at the ratio during a live demo without being signed in as anything in particular.
 */
export async function fetchCacheStats(): Promise<CacheStats> {
  return api.get<CacheStats>('/cache/stats');
}
