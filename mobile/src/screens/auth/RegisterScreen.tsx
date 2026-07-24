import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import axios from 'axios';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { PageContainer } from '../../components/ui';
import {
  ColorSchemeName,
  maxWidth,
  radius,
  shadow,
  spacing,
  ThemeColors,
  typography,
  useBreakpoint,
  useThemeStyles,
} from '../../theme';
import { OrDivider } from '../../components/OrDivider';
import { GoogleSignInButton, isGoogleSignInConfigured } from '../../components/GoogleSignInButton';
import { register } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import i18n from '../../i18n';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const MIN_PASSWORD_LENGTH = 8;

export function RegisterScreen({ navigation }: Props) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();
  const { isCompact } = useBreakpoint();
  const setSession = useAuthStore((s) => s.setSession);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.includes('@') && password.length >= MIN_PASSWORD_LENGTH;

  const handleRegister = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await register({
        email: email.trim(),
        password,
        fullName: fullName.trim() || undefined,
        languagePref: i18n.language,
      });
      setSession(response.accessToken, response.user);
    } catch (e) {
      // A taken email is the one failure the user can actually act on, so it gets
      // its own message instead of the generic one.
      setError(axios.isAxiosError(e) && e.response?.status === 409 ? t('auth.emailTaken') : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, !isCompact && styles.contentWide]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Same card as the sign-in screen, and deliberately the same width: the two
            screens hand off to each other, and a form that changes size on the way reads
            as a different page rather than the next step. */}
        <PageContainer maxWidth={maxWidth.form} style={styles.card}>
          <View style={styles.hero}>
            <Text style={styles.title}>{t('auth.registerTitle')}</Text>
            <Text style={styles.subtitle}>{t('auth.registerSubtitle')}</Text>
          </View>

          <View style={styles.form}>
            {/* Above the form, not below: the one-tap path should be the first
                thing offered when creating an account. */}
            {isGoogleSignInConfigured && (
              <>
                <GoogleSignInButton label={t('auth.signUpWithGoogle')} />
                <OrDivider label={t('auth.orWithEmail')} />
              </>
            )}

            <TextField
              label={t('auth.fullName')}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              textContentType="name"
            />
            <TextField
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <TextField
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              hint={t('auth.passwordHint')}
              secureToggle
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              // Enter submits from the last field, the desktop habit; disabled until the
              // form is actually valid so it can't fire a doomed request.
              onSubmitEditing={canSubmit ? handleRegister : undefined}
              returnKeyType="go"
            />

            {error && <Text style={styles.error}>{error}</Text>}
          </View>

          <View style={styles.foot}>
            <PrimaryButton
              title={t('auth.registerButton')}
              onPress={handleRegister}
              loading={loading}
              disabled={!canSubmit}
            />
            <Text style={styles.terms}>{t('auth.terms')}</Text>
            <Pressable hitSlop={8} onPress={() => navigation.navigate('Login')} style={styles.footLink}>
              <Text style={styles.footText}>
                {t('auth.haveAccount')} <Text style={styles.footAccent}>{t('auth.loginButton')}</Text>
              </Text>
            </Pressable>
          </View>
        </PageContainer>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: ThemeColors, scheme: ColorSchemeName) =>
  StyleSheet.create({
    flex: {
      flex: 1,
      backgroundColor: c.background,
    },
    content: {
      flexGrow: 1,
      padding: spacing.lg,
    },
    contentWide: {
      justifyContent: 'center',
      padding: spacing.xl,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: spacing.xl,
      ...shadow(scheme),
    },
    hero: {
      paddingTop: spacing.md,
    },
    title: {
      ...typography.title,
      color: c.text,
    },
    subtitle: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: spacing.xs,
    },
    form: {
      marginTop: spacing.lg,
    },
    error: {
      ...typography.caption,
      color: c.danger,
      backgroundColor: c.dangerSoft,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    foot: {
      marginTop: 'auto',
      paddingTop: spacing.lg,
    },
    terms: {
      ...typography.micro,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: spacing.md,
      lineHeight: 17,
    },
    footLink: {
      marginTop: spacing.md,
      alignItems: 'center',
    },
    footText: {
      ...typography.label,
      color: c.textMuted,
    },
    footAccent: {
      ...typography.labelStrong,
      color: c.primary,
    },
  });
