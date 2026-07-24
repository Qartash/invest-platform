import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { BrandMark } from '../../components/BrandMark';
import { OrDivider } from '../../components/OrDivider';
import { GoogleSignInButton, isGoogleSignInConfigured } from '../../components/GoogleSignInButton';
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
import { login } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();
  const { isCompact } = useBreakpoint();
  const setSession = useAuthStore((s) => s.setSession);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await login(identifier.trim(), password);
      setSession(response.accessToken, response.user);
    } catch {
      setError(t('auth.invalidCredentials'));
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
        {/* On a phone the form owns the whole screen and needs no frame around it. In a
            desktop window that same layout leaves two fields stretched across a metre of
            glass, so the form collapses into a card the width of what it actually asks
            for and sits in the middle of the window. */}
        <PageContainer maxWidth={maxWidth.form} style={styles.card}>
          <View style={[styles.hero, !isCompact && styles.heroWide]}>
            <BrandMark />
            <Text style={styles.title}>{t('auth.loginTitle')}</Text>
            <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>
          </View>

          <View style={styles.form}>
            <TextField
              label={t('auth.identifier')}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
            />
            <TextField
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureToggle
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              onSubmitEditing={identifier && password ? handleLogin : undefined}
              returnKeyType="go"
            />

            <Pressable hitSlop={8} style={styles.forgotRow}>
              <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
            </Pressable>

            {error && <Text style={styles.error}>{error}</Text>}

            <PrimaryButton
              title={t('auth.loginButton')}
              onPress={handleLogin}
              loading={loading}
              disabled={!identifier || !password}
            />

            {isGoogleSignInConfigured && (
              <>
                <OrDivider label={t('auth.or')} />
                <GoogleSignInButton label={t('auth.continueWithGoogle')} />
              </>
            )}
          </View>

          <View style={styles.foot}>
            <LanguageSwitcher />
            <Pressable hitSlop={8} onPress={() => navigation.navigate('Register')} style={styles.footLink}>
              <Text style={styles.footText}>
                {t('auth.noAccount')} <Text style={styles.footAccent}>{t('auth.registerButton')}</Text>
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
    // `flexGrow` (not `flex`) so the footer still sinks to the bottom on a tall
    // screen while the form stays scrollable once the keyboard covers it.
    content: {
      flexGrow: 1,
      padding: spacing.lg,
    },
    // The same free space that pushes the footer down on a phone is what centres the card
    // in a desktop window — `justifyContent` only has anything to distribute because
    // `flexGrow` above claimed the height.
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
      alignItems: 'center',
      paddingTop: spacing.xl,
    },
    // The card's own padding already separates the mark from the top edge; the phone
    // layout's extra breathing room would only make the card top-heavy.
    heroWide: {
      paddingTop: 0,
    },
    title: {
      ...typography.title,
      color: c.text,
      marginTop: spacing.md,
    },
    subtitle: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    form: {
      marginTop: spacing.xl,
    },
    forgotRow: {
      alignSelf: 'flex-end',
      marginBottom: spacing.md,
    },
    forgotText: {
      ...typography.captionStrong,
      color: c.primary,
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
      paddingTop: spacing.xl,
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
