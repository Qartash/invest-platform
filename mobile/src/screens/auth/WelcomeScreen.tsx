import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton } from '../../components/PrimaryButton';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { spacing, ThemeColors, useThemeStyles } from '../../theme';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>{t('onboarding.welcomeTitle')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.welcomeSubtitle')}</Text>
      </View>
      <View style={styles.actions}>
        <PrimaryButton title={t('auth.registerButton')} onPress={() => navigation.navigate('Register')} />
        <View style={{ height: spacing.md }} />
        <PrimaryButton title={t('auth.login')} variant="outline" onPress={() => navigation.navigate('Login')} />
        <View style={styles.languageSwitcher}>
          <LanguageSwitcher />
        </View>
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
      padding: spacing.lg,
      justifyContent: 'space-between',
    },
    hero: {
      marginTop: spacing.xl * 2,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: c.text,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: c.textMuted,
      textAlign: 'center',
    },
    actions: {
      marginBottom: spacing.xl,
    },
    languageSwitcher: {
      marginTop: spacing.lg,
    },
  });
