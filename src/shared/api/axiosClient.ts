import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { getSession } from 'next-auth/react';

import { ApiError } from './ApiError';
import type { ApiEnvelope, ApiErrorBody } from './types';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!baseURL) {
  // Fail loudly at module load rather than producing requests to `undefined/events`, which
  // surface as a confusing 404 from the Next dev server instead of a config error.
  throw new Error('NEXT_PUBLIC_API_BASE_URL is not set. Copy .env.example to .env.local.');
}

export const axiosClient = axios.create({
  baseURL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * The cached access token and its expiry, kept in module scope and written by `AuthTokenSync`.
 *
 * ─── Two bugs led to this design; both are worth knowing ─────────────────────
 *
 * **Bug 1 — a session fetch per request.** The first version called `await getSession()` in the request
 * interceptor with a comment claiming NextAuth cached it. It does not: `getSession()` is a raw `fetch`
 * to `/api/auth/session` every time, *and* it posts to a BroadcastChannel that can make other tabs
 * refetch too. Every API call cost a second round trip.
 *
 * **Bug 2 — fixing that broke refresh.** Caching the token removed the accidental refresh mechanism.
 * With a 15-minute token and a 10-minute `refetchInterval`, the arithmetic left a dead zone:
 *
 *     t=10  interval fires, token still has 5 min → jwt callback declines to refresh
 *     t=15  token EXPIRES
 *     t=15–20  every request 401s, and NOTHING refetches   ← the reported symptom
 *     t=20  next interval finally refreshes
 *
 * Polling can only ever paper over that; the interval and the TTL are independent numbers and any
 * mismatch reopens a window. So the trigger is now **expiry, not a timer**: ask for a fresh session
 * exactly when the token is about to die, and never otherwise.
 */
let accessToken: string | null = null;
let accessTokenExpiresAt = 0;

/** Refresh this long before actual expiry, to cover flight time and clock skew between hosts. */
const EXPIRY_SKEW_MS = 30_000;

/** Called by `AuthTokenSync` whenever the session changes. Not for use anywhere else. */
export function setAccessToken(token: string | null, expiresAt = 0): void {
  accessToken = token;
  accessTokenExpiresAt = expiresAt;
}

/**
 * One shared in-flight session fetch.
 *
 * Without this, a page firing four queries at once with an expired token makes four concurrent
 * `getSession()` calls, each triggering the `jwt` callback, each attempting a refresh-token rotation.
 * Against a backend with reuse detection that is the parallel-refresh race — and it would revoke the
 * whole token family, hard-signing-out a legitimate user.
 *
 * The backend's 30-second grace window (TR-DEC-017) already prevents the worst outcome, but relying on
 * it for something this cheap to avoid would be careless. Note this dedupe genuinely WORKS here, unlike
 * in NextAuth's server-side `jwt` callback: the browser is a single heap, so every caller sees the same
 * module-level promise.
 */
let sessionFetch: Promise<void> | null = null;

function refreshSessionOnce(): Promise<void> {
  if (!sessionFetch) {
    sessionFetch = getSession({ broadcast: false } as Parameters<typeof getSession>[0])
      .then((session) => {
        accessToken = session?.accessToken ?? null;
        accessTokenExpiresAt = session?.accessTokenExpiresAt ?? 0;
      })
      .catch(() => {
        // Leave the stale values in place. Clearing them would turn a transient network failure into a
        // guaranteed unauthenticated request, and the stale token may still be valid.
      })
      .finally(() => {
        sessionFetch = null;
      });
  }
  return sessionFetch;
}

function tokenIsUsable(): boolean {
  return Boolean(accessToken) && Date.now() < accessTokenExpiresAt - EXPIRY_SKEW_MS;
}

/**
 * Attaches the access token as a Bearer header, fetching a fresh session only when the cached one is
 * missing or about to expire.
 *
 * Reading the session server-side runs our `jwt` callback, which rotates the access token when it is
 * near expiry — so **this call IS the refresh mechanism**, triggered by need rather than by a clock.
 * In the common case it does nothing at all.
 *
 * The cost of this design, stated plainly: the token sits in client-side JavaScript memory
 * (TR-DEC-002), so an XSS payload can read and exfiltrate it and use it from anywhere until it expires.
 * The 15-minute lifetime IS the blast radius. In exchange, an `Authorization` header is never attached
 * automatically by the browser, so the API is structurally CSRF-immune.
 */
axiosClient.interceptors.request.use(async (config) => {
  // Browser only. On the server, callers should use `auth()` and pass the token explicitly —
  // getSession() has no cookie context there and would silently return null.
  if (typeof window === 'undefined') {
    return config;
  }

  if (!tokenIsUsable()) {
    await refreshSessionOnce();
  }

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

/**
 * Normalises every failure into an ApiError.
 *
 * Three distinct cases, and conflating them is a real source of bad UX:
 *   - no `error.response`  → the request never reached the server (offline, DNS, timeout,
 *                            CORS preflight rejection). Status 0.
 *   - a response body in our envelope shape → use its `message` and `errors`.
 *   - anything else → the server returned something unexpected; fall back to the status text.
 *
 * It also carries a 401 recovery path. Note what that is and is NOT: it re-reads the SESSION so the
 * `jwt` callback can rotate the token server-side. The browser never touches a refresh token
 * (TR-DEC-018), so this is not the classic "refresh in the interceptor" pattern — it is "ask the server
 * for a fresh session and try again once".
 */
axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    if (!error.response) {
      throw new ApiError(error.message || 'Network error', 0);
    }

    const { status, data, statusText } = error.response;

    /**
     * A 401 the expiry check did not predict — recover once.
     *
     * The proactive check above should make this rare, but it cannot be exhaustive: the clock on this
     * machine may disagree with the API's, the token may have been revoked server-side, or the page may
     * have been restored from a background tab with a long-stale cache.
     *
     * Forcing a session read triggers the `jwt` callback, which rotates the token if it can. `_retried`
     * caps this at exactly one attempt — without it, a genuinely dead session would loop forever, and
     * each iteration would be a refresh attempt against a backend that treats repeats as theft.
     */
    const config = error.config as (typeof error.config & { _retried?: boolean }) | undefined;

    if (status === 401 && config && !config._retried && typeof window !== 'undefined') {
      config._retried = true;
      await refreshSessionOnce();

      if (accessToken) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${accessToken}`;
        return axiosClient(config);
      }
    }

    const message =
      (data && typeof data === 'object' && data.message) || statusText || 'Request failed';

    throw new ApiError(message, status, data?.errors);
  },
);

/**
 * Unwraps the backend's `{ success, data }` envelope so callers work with the payload
 * directly. Every caller would otherwise write `.data.data`, and someone would eventually
 * forget the second one.
 */
async function unwrap<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  const response = await promise;
  return response.data.data;
}

export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    unwrap<T>(axiosClient.get<ApiEnvelope<T>>(url, config)),

  post: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    unwrap<T>(axiosClient.post<ApiEnvelope<T>>(url, body, config)),

  patch: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    unwrap<T>(axiosClient.patch<ApiEnvelope<T>>(url, body, config)),

  put: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    unwrap<T>(axiosClient.put<ApiEnvelope<T>>(url, body, config)),

  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    unwrap<T>(axiosClient.delete<ApiEnvelope<T>>(url, config)),
};
