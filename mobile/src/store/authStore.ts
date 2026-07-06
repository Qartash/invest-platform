import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthUser } from '../types';

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
      logout: () => set({ accessToken: null, user: null }),
      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
