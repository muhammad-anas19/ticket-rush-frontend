import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { JWT } from 'next-auth/jwt';

import { authConfig } from './config';
import type { BackendAuthResponse } from './types';

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

class BackendCredentialsError extends CredentialsSignin {
  constructor(public code: string) {
    super(code);
  }
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const response = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token.refreshToken }),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Refresh failed with ${response.status}`);
    }

    const envelope = (await response.json()) as { data: BackendAuthResponse };
    const data = envelope.data;

    return {
      ...token,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      accessTokenExpiresAt: data.accessTokenExpiresAt,
      error: undefined,
    };
  } catch {
    return { ...token, error: 'RefreshTokenError' };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const response = await fetch(`${API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
          cache: 'no-store',
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new BackendCredentialsError(body?.message ?? 'Sign-in failed');
        }

        const envelope = (await response.json()) as { data: BackendAuthResponse };
        const data = envelope.data;

        return {
          id: data.user.id,
          email: data.user.email,
          role: data.user.role,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          accessTokenExpiresAt: data.accessTokenExpiresAt,
        };
      },
    }),
  ],

  events: {
    async signOut(message) {
      if (!('token' in message) || !message.token?.refreshToken) {
        return;
      }

      try {
        await fetch(`${API}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: message.token.refreshToken }),
          cache: 'no-store',
        });
      } catch {
      }
    },
  },

  callbacks: {
    ...authConfig.callbacks,

    async jwt({ token, user }) {
      if (user) {
        return {
          ...token,
          id: user.id!,
          role: user.role!,
          accessToken: user.accessToken!,
          refreshToken: user.refreshToken!,
          accessTokenExpiresAt: user.accessTokenExpiresAt!,
        };
      }

      if (Date.now() < token.accessTokenExpiresAt - 30_000) {
        return token;
      }

      return refreshAccessToken(token);
    },

  },
});
