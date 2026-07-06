import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing } from '../theme';
import { useAuthStore } from '../store/authStore';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Avatar } from '../components/Avatar';
import { RichTextView } from '../components/RichTextView';
import { StatBlock } from '../components/StatBlock';
import { formatDate } from '../utils/date';
import { fetchWallet } from '../api/wallet';
import { fetchPortfolio } from '../api/portfolio';
import { Portfolio, Wallet } from '../types';
import { ProfileStackParamList } from '../navigation/ProfileNavigator';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function ProfileScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchWallet().then(setWallet);
      fetchPortfolio().then(setPortfolio);
    }, []),
  );

  const genderLabel = user?.gender
    ? t(`profile.gender${user.gender.charAt(0).toUpperCase()}${user.gender.slice(1)}`)
    : undefined;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>{t('profile.title')}</Text>

      <View style={styles.card}>
        <Pressable
          style={styles.editIconButton}
          onPress={() => navigation.navigate('EditProfile')}
          accessibilityLabel={t('profile.editProfile')}
          hitSlop={8}
        >
          <Text style={styles.editIconText}>✏️</Text>
        </Pressable>

        <View style={styles.headerRow}>
          <Avatar avatarUrl={user?.avatarUrl} avatarEmoji={user?.avatarEmoji} size={64} />
          <View style={styles.headerText}>
            <Text style={styles.name}>{user?.fullName || user?.username}</Text>
            {!!user?.occupation && <Text style={styles.occupation}>{user.occupation}</Text>}
            {user?.kycStatus === 'approved' && <Text style={styles.verified}>✓ {t('profile.verified')}</Text>}
          </View>
        </View>

        {!!user?.bio && (
          <View style={styles.bioBox}>
            <RichTextView html={user.bio} textStyle={styles.bio} color={colors.text} fontSize={14} />
          </View>
        )}

        <View style={styles.infoSection}>
          <InfoRow label={t('auth.username')} value={user?.username} />
          <InfoRow label={t('auth.email')} value={user?.email} />
          <InfoRow label={t('profile.phone')} value={user?.phone} />
          <InfoRow label={t('profile.telegram')} value={user?.telegram} />
          <InfoRow label={t('profile.linkedin')} value={user?.linkedin} />
          <InfoRow label={t('profile.birthDate')} value={user?.birthDate} />
          <InfoRow label={t('profile.gender')} value={genderLabel} />
          <InfoRow
            label={t('profile.memberSince')}
            value={user?.createdAt ? formatDate(user.createdAt, i18n.language) : undefined}
          />
          <InfoRow label={t('profile.kycStatus')} value={t(`profile.kyc.${user?.kycStatus ?? 'none'}`)} />
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatBlock
          icon="💰"
          label={t('wallet.title')}
          value={`${wallet ? parseFloat(wallet.balance).toLocaleString() : '—'} ${t('common.currency')}`}
          onPress={() => navigation.navigate('Wallet')}
        />
        <StatBlock
          icon="📊"
          label={t('portfolio.title')}
          value={`${portfolio ? portfolio.summary.totalCurrentValue.toLocaleString() : '—'} ${t('common.currency')}`}
          onPress={() => navigation.navigate('Portfolio')}
        />
      </View>

      <Text style={styles.sectionLabel}>{t('profile.language')}</Text>
      <View style={styles.languageRow}>
        <LanguageSwitcher compact />
      </View>

      <Pressable style={styles.logout} onPress={logout} hitSlop={8}>
        <Text style={styles.logoutText}>{t('profile.logout')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
    position: 'relative',
  },
  editIconButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  editIconText: {
    fontSize: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingRight: 40,
  },
  headerText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  occupation: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  verified: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
    marginTop: 2,
  },
  bioBox: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  bio: {
    fontSize: 14,
    color: colors.text,
  },
  infoSection: {
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
    columnGap: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  languageRow: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logout: {
    alignSelf: 'center',
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
  },
});
