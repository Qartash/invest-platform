import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { spacing, ThemeColors, useThemeStyles } from '../../theme';
import { login } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';

export function LoginScreen() {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();
  const setSession = useAuthStore((s) => s.setSession);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await login(username.trim(), password);
      setSession(response.accessToken, response.user);
    } catch {
      setError(t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextField
        label={t('auth.username')}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <PrimaryButton
        title={t('auth.loginButton')}
        onPress={handleLogin}
        loading={loading}
        disabled={!username || !password}
      />
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
      padding: spacing.lg,
      paddingTop: spacing.xl,
    },
    error: {
      color: c.danger,
      marginBottom: spacing.md,
    },
  });
