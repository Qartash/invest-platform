import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthUser } from '../types';
import { clearQueryCache } from '../api/useCachedQuery';
import { useNotificationsStore } from './notificationsStore';

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isHydrated: boolean;
  setSession: (accessToken: string, user: AuthUser) => void;
  updateUser: (user: AuthUser) => void;
  logout: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isHydrated: false,
      setSession: (accessToken, user) => set({ accessToken, user }),
      updateUser: (user) => set({ user }),
      // The query cache goes with the session. Its keys name endpoints, not people, so
      // anything left behind would be shown to whoever signs in next on this device.
      // The unread badge is the same kind of leftover, kept outside the cache.
      logout: () => {
        clearQueryCache();
        useNotificationsStore.getState().reset();
        set({ accessToken: null, user: null });
      },
      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
