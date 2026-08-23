/** Mirrors the backend's `GET /api/cache/stats` response exactly — see CacheService.getStats(). */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRatio: number;
}
