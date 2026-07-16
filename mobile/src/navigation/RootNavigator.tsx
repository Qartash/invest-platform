import React, { useMemo } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { useTheme } from '../theme';

export function RootNavigator() {
  const user = useAuthStore((s) => s.user);
  const { colors, isDark } = useTheme();

  // Header bars, screen backgrounds and the back-gesture card are painted by React
  // Navigation itself, so the palette has to be handed to it as well.
  const navTheme = useMemo<Theme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: isDark,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [colors, isDark]);

  return <NavigationContainer theme={navTheme}>{!user ? <AuthNavigator /> : <MainNavigator />}</NavigationContainer>;
}
