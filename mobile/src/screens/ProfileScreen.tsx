import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  maxWidth,
  radius,
  spacing,
  tabularNums,
  ThemeColors,
  ThemePreference,
  typography,
  useBreakpoint,
  useTheme,
  useThemeStyles,
} from '../theme';
import { useAuthStore } from '../store/authStore';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Avatar } from '../components/Avatar';
import { RichTextView } from '../components/RichTextView';
import { Card, ListGroup, ListRow, PageContainer, Pill, SectionHeader, SegmentedTabs } from '../components/ui';
import { formatDate } from '../utils/date';
import { showAlert } from '../utils/alert';
import { fetchWallet } from '../api/wallet';
import { fetchPortfolio } from '../api/portfolio';
import { fetchUserWorks } from '../api/projectWorks';
import { useCachedQuery } from '../api/useCachedQuery';
import { Portfolio, UserWorks, Wallet } from '../types';
import { HelpButton, TourTarget } from '../onboarding';
import { ProfileStackParamList } from '../navigation/ProfileNavigator';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors, preference, setPreference } = useTheme();
  const insets = useSafeAreaInsets();
  const { isCompact } = useBreakpoint();
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  // The balance key sits under the same `wallet:` prefix the wallet screen invalidates, so a
  // deposit made there retires this copy too. The portfolio key is the very one that screen
  // reads, which is what makes stepping between the two instant.
  const { data: wallet } = useCachedQuery<Wallet>('wallet:balance', fetchWallet);
  const { data: portfolio } = useCachedQuery<Portfolio>('portfolio', fetchPortfolio);
  const { data: works } = useCachedQuery<UserWorks>(
    `works:user:${user?.id ?? ''}`,
    useCallback(() => fetchUserWorks(user!.id), [user?.id]),
    { enabled: !!user?.id },
  );

  const worksDone = works?.completedCount ?? 0;
  const worksRating = works?.averageRating ?? null;

  const genderLabel = user?.gender
    ? t(`profile.gender${user.gender.charAt(0).toUpperCase()}${user.gender.slice(1)}`)
    : undefined;

  const money = (value: string | number | undefined) =>
    value === undefined ? '—' : `${Number(value).toLocaleString()} ${t('common.currency')}`;

  const investCredit = parseFloat(wallet?.investCredit ?? '0');
  const hasContacts = !!(user?.phone || user?.telegram || user?.linkedin);

  const handleLogout = () =>
    showAlert(t('profile.logoutConfirmTitle'), t('profile.logoutConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: logout },
    ]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
    >
      {/* The page is one readable column on a phone and two on a desktop window. The identity
          card and the section columns share one `page` cap so they stay the same width as
          each other; the split into two columns happens only below `md`. */}
      <PageContainer maxWidth={maxWidth.page}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>{t('profile.title')}</Text>
        <HelpButton topic="profile" tour="investor" />
      </View>

      <TourTarget id="profile.identity">
      <Card style={styles.identityCard}>
        <Pressable
          style={styles.editButton}
          onPress={() => navigation.navigate('EditProfile')}
          accessibilityLabel={t('profile.editProfile')}
          hitSlop={8}
        >
          <Text style={styles.editIcon}>✏️</Text>
        </Pressable>

        <View style={styles.identityRow}>
          <Avatar avatarUrl={user?.avatarUrl} avatarEmoji={user?.avatarEmoji} size={64} />
          <View style={styles.identityText}>
            <Text style={styles.name} numberOfLines={2}>
              {user?.fullName || user?.username}
            </Text>
            {!!user?.occupation && (
              <Text style={styles.occupation} numberOfLines={1}>
                {user.occupation}
              </Text>
            )}
            <View style={styles.badgeRow}>
              {user?.kycStatus === 'approved' && <Pill label={`✓ ${t('profile.verified')}`} tone="success" />}
              {user?.role === 'admin' && <Pill label={t('profile.adminBadge')} tone="primary" />}
            </View>
          </View>
        </View>

        {!!user?.bio && (
          <View style={styles.bioBox}>
            <RichTextView html={user.bio} textStyle={styles.bio} color={colors.text} fontSize={14} />
          </View>
        )}
      </Card>
      </TourTarget>

      <View style={[styles.columns, !isCompact && styles.columnsWide]}>
        <View style={!isCompact && styles.columnWide}>
      <SectionHeader title={t('profile.financeSection')} spaced />
      <TourTarget id="profile.finance">
      <ListGroup>
        <ListRow
          icon="wallet"
          label={t('wallet.title')}
          sublabel={
            investCredit > 0 ? `${t('wallet.investCredit')}: ${money(investCredit)}` : t('profile.walletSubtitle')
          }
          right={<Text style={styles.rowMoney}>{money(wallet?.balance)}</Text>}
          onPress={() => navigation.navigate('Wallet')}
        />
        <ListRow
          icon="briefcase"
          label={t('portfolio.title')}
          sublabel={t('profile.portfolioSubtitle')}
          right={<Text style={styles.rowMoney}>{money(portfolio?.summary.totalCurrentValue)}</Text>}
          onPress={() => navigation.navigate('Portfolio')}
        />
        {/* Platform-wide turnover and a by-name feed of everyone's deposits — moderation
            figures, not the user's own. The API refuses non-admins; don't offer the door. */}
        {user?.role === 'admin' && (
          <ListRow
            icon="trendUp"
            label={t('reports.title')}
            sublabel={t('profile.reportsSubtitle')}
            onPress={() => navigation.navigate('Reports')}
          />
        )}
      </ListGroup>
      </TourTarget>

      <SectionHeader title={t('referrals.communitySection')} spaced />
      <TourTarget id="profile.community">
      <ListGroup>
        <ListRow
          icon="users"
          label={t('referrals.title')}
          sublabel={t('referrals.profileSub')}
          onPress={() => navigation.navigate('Referrals')}
        />
        <ListRow
          icon="checklist"
          label={t('quests.title')}
          sublabel={t('quests.profileSub')}
          onPress={() => navigation.navigate('Quests')}
        />
      </ListGroup>
      </TourTarget>

      {/* The way back into onboarding, and the reason nothing else has to nag: whatever the
          tour explained once is readable here for as long as the account exists. */}
      <SectionHeader title={t('guide.sectionTitle')} spaced />
      <TourTarget id="profile.guide">
        <ListGroup>
          <ListRow
            icon="checklist"
            label={t('guide.title')}
            sublabel={t('guide.profileSub')}
            onPress={() => navigation.navigate('Guide')}
          />
        </ListGroup>
      </TourTarget>

      <SectionHeader title={t('profile.accountSection')} spaced />
      <TourTarget id="profile.account">
      <ListGroup>
        <ListRow label={t('auth.username')} value={user?.username} />
        <ListRow label={t('auth.email')} value={user?.email} />
        {user?.birthDate ? <ListRow label={t('profile.birthDate')} value={user.birthDate} /> : null}
        {genderLabel ? <ListRow label={t('profile.gender')} value={genderLabel} /> : null}
        {user?.createdAt ? (
          <ListRow label={t('profile.memberSince')} value={formatDate(user.createdAt, i18n.language)} />
        ) : null}
        <ListRow
          label={t('profile.kycStatus')}
          right={
            <Pill
              label={t(`profile.kyc.${user?.kycStatus ?? 'none'}`)}
              tone={
                user?.kycStatus === 'approved'
                  ? 'success'
                  : user?.kycStatus === 'pending'
                    ? 'warning'
                    : user?.kycStatus === 'rejected'
                      ? 'danger'
                      : 'neutral'
              }
            />
          }
        />
        {worksDone > 0 ? (
          <ListRow
            label={t('works.completedCount')}
            value={`${worksDone}${worksRating !== null ? ` · ★ ${worksRating.toFixed(1)}` : ''}`}
          />
        ) : null}
      </ListGroup>
      </TourTarget>
      <Text style={styles.note}>
        {user?.kycStatus === 'approved' ? t('profile.kycExplainVerified') : t('profile.kycExplain')}
      </Text>
        </View>

        <View style={!isCompact && styles.columnWide}>
      {hasContacts && (
        <>
          <SectionHeader title={t('profile.contactsSection')} spaced />
          <ListGroup>
            {user?.phone ? <ListRow label={t('profile.phone')} value={user.phone} /> : null}
            {user?.telegram ? <ListRow label={t('profile.telegram')} value={user.telegram} /> : null}
            {user?.linkedin ? <ListRow label={t('profile.linkedin')} value={user.linkedin} /> : null}
          </ListGroup>
        </>
      )}

      <SectionHeader title={t('profile.appearance')} spaced />
      <TourTarget id="profile.appearance">
      <Card>
        <Text style={styles.settingLabel}>{t('profile.theme')}</Text>
        <SegmentedTabs
          active={preference}
          onChange={(next: ThemePreference) => setPreference(next)}
          tabs={[
            { key: 'system', label: t('profile.themeSystem') },
            { key: 'light', label: t('profile.themeLight') },
            { key: 'dark', label: t('profile.themeDark') },
          ]}
        />
        <Text style={styles.settingHint}>{t('profile.themeHint')}</Text>

        <View style={styles.settingDivider} />

        <Text style={styles.settingLabel}>{t('profile.language')}</Text>
        <LanguageSwitcher />
      </Card>
      </TourTarget>

      <Pressable style={styles.logout} onPress={handleLogout} hitSlop={8}>
        <Text style={styles.logoutText}>{t('profile.logout')}</Text>
      </Pressable>
        </View>
      </View>
      </PageContainer>
    </ScrollView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    content: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xl,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    header: {
      ...typography.display,
      color: c.text,
      flexShrink: 1,
    },

    // On a phone the two "columns" are just the normal top-to-bottom flow. On a wide window
    // they sit side by side and share the row evenly, so the account details and the
    // appearance settings fill the height the identity card left rather than trailing far
    // below it.
    columns: {},
    columnsWide: {
      flexDirection: 'row',
      gap: spacing.lg,
      alignItems: 'flex-start',
    },
    // `flex: 1` belongs to the wide layout only, where it splits the row in two.
    // In the compact layout the parent has no flexDirection, so it stacks — and
    // there `flex: 1` made the two columns fight over the height instead of taking
    // what they needed, which is why "CONTACTS" was drawn on top of the KYC row.
    columnWide: {
      flex: 1,
    },

    identityCard: {
      borderRadius: radius.xl,
    },
    editButton: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      backgroundColor: c.surfaceSunken,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    editIcon: {
      fontSize: 14,
    },
    identityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingRight: 40,
    },
    identityText: {
      flex: 1,
    },
    name: {
      ...typography.heading,
      color: c.text,
    },
    occupation: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: 2,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs + 2,
      marginTop: spacing.sm - 2,
    },
    bioBox: {
      marginTop: spacing.md - 4,
      paddingTop: spacing.md - 4,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    bio: {
      ...typography.label,
      color: c.text,
    },

    rowMoney: {
      ...typography.labelStrong,
      ...tabularNums,
      color: c.text,
    },
    note: {
      ...typography.micro,
      color: c.textMuted,
      lineHeight: 17,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.xs,
    },

    settingLabel: {
      ...typography.captionStrong,
      color: c.text,
      marginBottom: spacing.sm,
    },
    settingHint: {
      ...typography.micro,
      color: c.textMuted,
      marginTop: spacing.sm,
    },
    settingDivider: {
      height: 1,
      backgroundColor: c.border,
      marginVertical: spacing.md,
    },

    logout: {
      alignSelf: 'center',
      marginTop: spacing.xl,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    logoutText: {
      ...typography.captionStrong,
      color: c.danger,
    },
  });
