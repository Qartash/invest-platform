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
    }
    return Promise.reject(error);
  },
);
