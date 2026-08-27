import { api } from '@/shared/api/axiosClient';

import type { User, UserRole } from '../model/user.types';

export interface RegisterPayload {
  email: string;
  password: string;
  role: UserRole;
}

export async function registerUser(payload: RegisterPayload): Promise<User> {
  return api.post<User>('/auth/register', payload);
}
