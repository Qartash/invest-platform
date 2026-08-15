import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

export function resolveMediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  return path.startsWith('http') ? path : `${API_ORIGIN}${path}`;
}

export const apiClient = axios.create({ baseURL: API_URL });

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Signing in or registering answers 401 to mean "those credentials are wrong", which is the
// one 401 that must not end the session — there is no session yet.
const AUTH_ROUTES = ['/auth/login', '/auth/register', '/auth/google'];

// Requests that never reach the backend (offline, timeout, DNS failure, CORS) can't be logged
// server-side — this is the only place that ever sees them, so it logs straight to the same
// /logs/client endpoint the rest of the app uses (a plain axios call, not the apiClient
// instance, to avoid recursing back through this same interceptor on failure).
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      axios
        .post(`${API_URL}/logs/client`, {
          category: 'network_error',
          message: error.message ?? 'Network request failed',
          level: 'error',
          metadata: { url: error.config?.url, method: error.config?.method },
        })
        .catch(() => {});
    } else if (
      error.response.status === 401 &&
      !AUTH_ROUTES.some((route) => error.config?.url?.startsWith(route))
    ) {
      // The token no longer identifies anybody — expired, or the account it named is gone
      // or blocked (see JwtStrategy). The session is kept on the device, and the navigator
      // decides which half of the app to show from *that* copy rather than from the server,
      // so without this the app stayed "signed in" around a token every request refused:
      // a profile drawn from the stored snapshot, a moderation tab the account may no
      // longer be entitled to, and every screen that needs the server showing an error or
      // a dash. Dropping the session puts the sign-in screen up, which is the honest answer
      // and the only one the person can act on.
      //
      // Read from the store lazily on purpose: this module is imported by the store it is
      // reaching into, and calling at request time rather than at import time is what keeps
      // that circle harmless.
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
