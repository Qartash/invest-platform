import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { initI18n } from './src/i18n';
import { useAuthStore } from './src/store/authStore';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { patchConsoleLogging } from './src/utils/consoleLogger';
import { colors } from './src/theme';

patchConsoleLogging();

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  if (!i18nReady || !isHydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <RootNavigator />
      <StatusBar style="auto" />
    </ErrorBoundary>
  );
}
