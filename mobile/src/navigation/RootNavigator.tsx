import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { documentTitle, linking } from './linking';
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

  return (
    // Native keeps its screen-state-only navigation: URL routing needs a registered scheme
    // and a native dependency there, and the defect it fixes (reload losing the route,
    // unshareable links) only exists in the browser.
    <NavigationContainer
      theme={navTheme}
      linking={Platform.OS === 'web' ? linking : undefined}
      documentTitle={documentTitle}
    >
      {!user ? <AuthNavigator /> : <MainNavigator />}
    </NavigationContainer>
  );
}
