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
 * The access token, held in module scope and refreshed by `AuthTokenSync` (see app/providers.tsx).
 *
 * ─── Why this exists, and what it replaced ───────────────────────────────────
 *
 * The first version called `await getSession()` inside the request interceptor, on EVERY request, with a
 * comment claiming NextAuth cached it. **That comment was wrong.** `getSession()` is a raw `fetch` to
 * `/api/auth/session` with no cache at all:
 *
 *   export async function getSession(params) {
 *     const session = await fetchData("session", ...);      // ← real network call, every time
 *     getNewBroadcastChannel().postMessage({ ... });        // ← and it notifies other tabs
 *     return session;
 *   }
 *
 * So every API call cost a second HTTP round trip, and the BroadcastChannel post could make OTHER open
 * tabs refetch their session too. Loading a page with three queries meant three extra session calls plus
 * three broadcasts. That is what showed up in the network tab as repeated `/api/auth/session` requests.
 *
 * Now the token is written here once whenever the session changes, and read synchronously per request.
 */
let accessToken: string | null = null;

/** Called by `AuthTokenSync` on every session change. Not for use anywhere else. */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/**
 * Attaches the access token as a Bearer header.
 *
 * Synchronous in the common case — no await, no fetch. The `getSession()` fallback covers exactly one
 * situation: a request firing before `AuthTokenSync`'s effect has run, which can happen on the very first
 * render. Without it, that request would go out unauthenticated and 401 for no good reason.
 *
 * What this design costs, stated plainly: the token is in client-side JavaScript memory (TR-DEC-002), so
 * an XSS payload can read and exfiltrate it and use it from anywhere until it expires. The 15-minute
 * lifetime IS the blast radius. In exchange an `Authorization` header is never attached automatically by
 * the browser, so the API is structurally CSRF-immune — no CSRF token, no guard, no double-submit cookie.
 */
axiosClient.interceptors.request.use(async (config) => {
  // Browser only. On the server, callers should use `auth()` and pass the token explicitly — getSession()
  // has no cookie context there and would silently return null.
  if (typeof window === 'undefined') {
    return config;
  }

  if (!accessToken) {
    // `broadcast: false` so this fallback does not tell every other tab to refetch its session — the
    // cascade that made the original problem worse than a single extra call.
    const session = await getSession({ broadcast: false } as Parameters<typeof getSession>[0]);
    accessToken = session?.accessToken ?? null;
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
 * Note there is deliberately NO 401 → refresh → retry flow here — that is absent by design, not
 * missing. Refresh lives in NextAuth's `jwt` callback, server-side, because the refresh token never
 * reaches the browser (TR-DEC-018). The parallel-refresh race that a browser interceptor solves with
 * one shared in-flight promise is instead handled by the backend's 30-second grace window
 * (TR-DEC-017), because the promise trick does not work server-side where concurrent callbacks may
 * run in different processes with separate heaps.
 */
axiosClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    if (!error.response) {
      throw new ApiError(error.message || 'Network error', 0);
    }

    const { status, data, statusText } = error.response;
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
