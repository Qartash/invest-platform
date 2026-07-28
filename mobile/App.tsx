import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { initI18n } from './src/i18n';
import { useAuthStore } from './src/store/authStore';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { AlertHost } from './src/components/AlertHost';
import { OnboardingHost } from './src/onboarding';
import { patchConsoleLogging } from './src/utils/consoleLogger';
import { ThemeProvider, useTheme } from './src/theme';

patchConsoleLogging();

function AppContent() {
  const { colors, isDark } = useTheme();
  const [i18nReady, setI18nReady] = useState(false);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  if (!i18nReady || !isHydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <RootNavigator />
      {/* Sits beside the navigator, not inside it, so a message survives the screen that
          raised it navigating away. */}
      <AlertHost />
      {/* Beside the navigator for the same reason as the alerts, and for one more: a tour
          step walks the user between screens, so it cannot live on any one of them. */}
      <OnboardingHost />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
