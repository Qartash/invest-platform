import { apiClient } from './client';
import { AuthUser } from '../types';

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export function login(username: string, password: string) {
  return apiClient.post<AuthResponse>('/auth/login', { username, password }).then((r) => r.data);
}

export function register(data: { username: string; password: string; fullName?: string; languagePref?: string }) {
  return apiClient.post<AuthResponse>('/auth/register', data).then((r) => r.data);
}
