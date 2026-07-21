import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleLogo } from './GoogleLogo';
import { radius, spacing, ThemeColors, typography, useTheme, useThemeStyles } from '../theme';
import { loginWithGoogle } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { logEvent } from '../utils/logger';

// Closes the popup and hands the result back to the hook once Google redirects.
// Must run at module scope, before the component mounts.
WebBrowser.maybeCompleteAuthSession();

const CLIENT_IDS = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
};

export const isGoogleSignInConfigured = Object.values(CLIENT_IDS).some(Boolean);

interface Props {
  /** Wording differs between the sign-in and sign-up screens. */
  label: string;
}

export function GoogleSignInButton({ label }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const setSession = useAuthStore((s) => s.setSession);
  const [exchanging, setExchanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(CLIENT_IDS);

  useEffect(() => {
    if (response?.type !== 'success') {
      // A dismissed popup is the user changing their mind, not a failure worth
      // showing — only genuine errors from Google surface.
      if (response?.type === 'error') setError(t('auth.googleFailed'));
      return;
    }
    const idToken = response.params?.id_token;
    if (!idToken) {
      setError(t('auth.googleFailed'));
      return;
    }
    let cancelled = false;
    setExchanging(true);
    loginWithGoogle(idToken)
      .then((session) => {
        if (!cancelled) setSession(session.accessToken, session.user);
      })
      .catch(() => {
        if (!cancelled) setError(t('auth.googleFailed'));
      })
      .finally(() => {
        if (!cancelled) setExchanging(false);
      });
    return () => {
      cancelled = true;
    };
  }, [response, setSession, t]);

  if (!isGoogleSignInConfigured) {
    return null;
  }

  const handlePress = () => {
    setError(null);
    logEvent('click', label, { component: 'GoogleSignInButton' });
    promptAsync();
  };

  return (
    <View>
      <Pressable
        onPress={handlePress}
        disabled={!request || exchanging}
        style={({ pressed }) => [styles.button, (!request || exchanging) && styles.disabled, pressed && styles.pressed]}
      >
        {exchanging ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <GoogleLogo />
            <Text style={styles.label}>{label}</Text>
          </>
        )}
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm + 2,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    disabled: {
      opacity: 0.5,
    },
    pressed: {
      opacity: 0.85,
    },
    label: {
      ...typography.subheading,
      color: c.text,
    },
    error: {
      ...typography.caption,
      color: c.danger,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
  });
