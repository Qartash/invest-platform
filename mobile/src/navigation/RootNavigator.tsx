import React, { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { documentTitle, linking } from './linking';
import { useTheme } from '../theme';
import { captureInviteFromUrl, useReferralStore } from '../store/referralStore';
import { navigationRef } from './navigationRef';

// Runs once at import, before the NavigationContainer reads the URL, so a shared
// `/i/CODE` link is turned into a pending code + a `/register` address in time.
captureInviteFromUrl();

export function RootNavigator() {
  const user = useAuthStore((s) => s.user);
  const pendingProjectId = useReferralStore((s) => s.pendingProjectId);
  const clearPendingProjectId = useReferralStore((s) => s.clearPendingProjectId);
  const { colors, isDark } = useTheme();

  // Delivers an invitee to the project they were actually invited to.
  //
  // An invite into a project is a link to something concrete, and that is the whole reason it
  // converts better than a bare one — but a visitor with no account cannot be shown a project,
  // so they go to sign-up and the address bar loses it. This is the other half: the moment a
  // session exists, walk them to the project that brought them here. It runs for a signed-in
  // recipient too, where it is a no-op that lands on the screen they were already going to.
  useEffect(() => {
    if (!user || !pendingProjectId || !navigationRef.isReady()) return;
    // Cast as the onboarding host does: the ref carries no param list, so a nested
    // tab -> stack -> screen target cannot be expressed in its types.
    (navigationRef.navigate as (name: string, params?: unknown) => void)('HomeTab', {
      screen: 'ProjectDetail',
      params: { projectId: pendingProjectId },
    });
    clearPendingProjectId();
  }, [user, pendingProjectId, clearPendingProjectId]);

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
      ref={navigationRef}
      theme={navTheme}
      linking={Platform.OS === 'web' ? linking : undefined}
      documentTitle={documentTitle}
    >
      {!user ? <AuthNavigator /> : <MainNavigator />}
    </NavigationContainer>
  );
}
