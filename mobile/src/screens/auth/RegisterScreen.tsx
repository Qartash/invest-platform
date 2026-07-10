import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, spacing } from '../../theme';
import { register } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import i18n from '../../i18n';

export function RegisterScreen() {
  const { t } = useTranslation();
  const setSession = useAuthStore((s) => s.setSession);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await register({
        username: username.trim(),
        password,
        fullName: fullName.trim() || undefined,
        languagePref: i18n.language,
      });
      setSession(response.accessToken, response.user);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextField label={t('auth.fullName')} value={fullName} onChangeText={setFullName} />
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
        title={t('auth.registerButton')}
        onPress={handleRegister}
        loading={loading}
        disabled={!username || password.length < 3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
});
