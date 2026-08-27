import type { DefaultSession } from 'next-auth';

import type { UserRole } from '../model/roles';

export type { UserRole };

export interface BackendAuthResponse {
  user: {
    id: string;
    email: string;
    role: UserRole;
    createdAt: string;
  };
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
}

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    accessTokenExpiresAt?: number;
    error?: 'RefreshTokenError';
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession['user'];
  }

  interface User {
    id?: string;
    email?: string | null;
    role?: UserRole;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: number;
    error?: 'RefreshTokenError';
  }
}
