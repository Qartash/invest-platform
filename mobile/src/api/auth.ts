import { apiClient } from './client';
import { AuthUser } from '../types';

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

// `username` carries whichever identifier was typed — the backend resolves it
// against both the username and the email column.
export function login(identifier: string, password: string) {
  return apiClient.post<AuthResponse>('/auth/login', { username: identifier, password }).then((r) => r.data);
}

// The id_token is verified server-side against our OAuth client IDs — the client
// never decides who the user is.
export function loginWithGoogle(idToken: string) {
  return apiClient.post<AuthResponse>('/auth/google', { idToken }).then((r) => r.data);
}

export function register(data: { email: string; password: string; fullName?: string; languagePref?: string }) {
  return apiClient.post<AuthResponse>('/auth/register', data).then((r) => r.data);
}
