import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { getSession } from 'next-auth/react';

import { ApiError } from './ApiError';
import type { ApiEnvelope, ApiErrorBody } from './types';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!baseURL) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is not set. Copy .env.example to .env.local.');
}

export const axiosClient = axios.create({
  baseURL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

let accessToken: string | null = null;
let accessTokenExpiresAt = 0;

const EXPIRY_SKEW_MS = 30_000;

export function setAccessToken(token: string | null, expiresAt = 0): void {
  accessToken = token;
  accessTokenExpiresAt = expiresAt;
}

let sessionFetch: Promise<void> | null = null;

function refreshSessionOnce(): Promise<void> {
  if (!sessionFetch) {
    sessionFetch = getSession({ broadcast: false } as Parameters<typeof getSession>[0])
      .then((session) => {
        accessToken = session?.accessToken ?? null;
        accessTokenExpiresAt = session?.accessTokenExpiresAt ?? 0;
      })
      .catch(() => {
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

export async function getSocketAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!tokenIsUsable()) {
    await refreshSessionOnce();
  }

  return accessToken;
}

axiosClient.interceptors.request.use(async (config) => {
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

axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    if (!error.response) {
      throw new ApiError(error.message || 'Network error', 0);
    }

    const { status, data, statusText } = error.response;

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
