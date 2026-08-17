import axios, { AxiosError, AxiosRequestConfig } from 'axios';

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
 * Normalises every failure into an ApiError.
 *
 * Three distinct cases, and conflating them is a real source of bad UX:
 *   - no `error.response`  → the request never reached the server (offline, DNS, timeout,
 *                            CORS preflight rejection). Status 0.
 *   - a response body in our envelope shape → use its `message` and `errors`.
 *   - anything else → the server returned something unexpected; fall back to the status text.
 *
 * M1 adds the Authorization header here from the NextAuth session, plus the 401 → refresh →
 * retry flow with a single shared in-flight promise. That last detail is not optional: with
 * refresh-token rotation and reuse detection on the backend, several requests refreshing in
 * parallel present an already-consumed token and get the whole session killed as suspected
 * theft.
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
