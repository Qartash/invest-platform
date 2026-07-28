import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  maxWidth,
  radius,
  spacing,
  tabularNums,
  ThemeColors,
  typography,
  useTheme,
  useThemeStyles,
} from '../../theme';
import { Card, Icon, ListGroup, ListRow, PageContainer, SectionHeader, StatStrip } from '../../components/ui';
import { fetchReferralSummary, ReferralSummary } from '../../api/referrals';
import { useCachedQuery } from '../../api/useCachedQuery';
import { checkIn } from '../../api/activity';
import { fetchProjects } from '../../api/projects';
import { getLocalizedText } from '../../utils/localized';
import { Project } from '../../types';
import { copyText, shareText } from '../../utils/clipboard';
import { showAlert } from '../../utils/alert';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { fetchPartnerStatus, PartnerStatus } from '../../api/partners';
import { LoadFailed } from '../../components/LoadFailed';
import { HelpButton, TourTarget, useAutoTour } from '../../onboarding';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Referrals'>;

const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? 'https://invest.am';

export function ReferralScreen({ navigation }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  // Three separate cached queries rather than one combined load: they fail independently
  // (only the code is worth blanking the screen over) and two of them are shared — the
  // project feed under the same key the home screen uses, and the partner status with the
  // blogger screen. Coming back to this tab redraws from those instead of refetching.
  const {
    data: summary,
    error: summaryError,
    refresh: refreshSummary,
  } = useCachedQuery<ReferralSummary>('referrals:summary', fetchReferralSummary);
  const { data: fetchedProjects } = useCachedQuery<Project[]>(
    'projects:active',
    useCallback(() => fetchProjects('active'), []),
  );
  const { data: partner } = useCachedQuery<PartnerStatus>('partners:status', fetchPartnerStatus);
  // The ladder, the invest credit and the quest bonuses are the least self-evident part of
  // the app, so this section explains itself the first time it is opened.
  useAutoTour('referrals');

  const projects = fetchedProjects ?? [];
  // The code is the one thing people come here for, so its failure is the one that blanks
  // the screen — and only when there is nothing cached to show in its place. Without it the
  // card would read "—" as though the account had no code.
  const loadFailed = !summary && !!summaryError;

  // Opening this screen also counts as activity — keeps the streak honest even for someone
  // who lives on the invites page.
  useFocusEffect(
    useCallback(() => {
      checkIn().catch(() => {});
    }, []),
  );

  // Which of the four things the blogger card should say. `changes_requested` and a
  // rejection both put the applicant back at "you can apply", because both are states
  // they can act on by applying again — only a pending one is a wait.
  const partnerState = partner?.isPartner
    ? 'isPartner'
    : partner?.application?.status === 'pending'
      ? 'pending'
      : partner?.application?.status === 'changes_requested'
        ? 'changesRequested'
        : 'canApply';

  const code = summary?.referralCode ?? '—';
  const link = `${APP_URL}/i/${code}`;
  const money = (v: number) => `${v.toLocaleString()} ${t('common.currency')}`;

  // An invite that opens a specific project. The path is the app's real project
  // route, so a signed-in recipient lands on the project itself; `i` is consumed
  // at startup and still attributes the sign-up of a signed-out one.
  const projectLink = (projectId: string) => `${APP_URL}/projects/${projectId}?i=${code}`;

  const onShare = () =>
    shareText(t('referrals.shareMessage', { link })).catch(() => {});

  const onCopy = async () => {
    const ok = await copyText(link);
    if (ok) showAlert(t('referrals.copied'), link);
    else onShare();
  };

  const onShareProject = async (project: Project) => {
    const title = getLocalizedText(project.title, i18n.language);
    const url = projectLink(project.id);
    const message = t('referrals.shareProjectMessage', { title, link: url });
    // Copying is the quieter option where it works; the share sheet is the
    // fallback (and the only path on native).
    const copied = await copyText(url);
    if (copied) showAlert(t('referrals.copied'), url);
    else shareText(message).catch(() => {});
  };

  if (loadFailed) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <PageContainer maxWidth={maxWidth.column}>
          <LoadFailed onRetry={refreshSummary} />
        </PageContainer>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageContainer maxWidth={maxWidth.column}>
        {/* Code card — the one thing people came here to get. */}
        <TourTarget id="referrals.code">
        <Card accented style={styles.codeCard}>
          <View style={styles.codeHead}>
            <Text style={styles.codeEyebrow}>{t('referrals.yourCode')}</Text>
            <HelpButton topic="referrals" tour="referrals" />
          </View>
          <Text style={styles.codeValue} selectable>
            {code}
          </Text>
          <View style={styles.codeActions}>
            <Pressable style={styles.codeButton} onPress={onShare}>
              <Icon name="users" color={colors.textOnAccent} size={16} />
              <Text style={styles.codeButtonText}>{t('referrals.share')}</Text>
            </Pressable>
            <Pressable style={styles.codeButton} onPress={onCopy}>
              <Icon name="file" color={colors.textOnAccent} size={16} />
              <Text style={styles.codeButtonText}>{t('referrals.copyLink')}</Text>
            </Pressable>
          </View>
        </Card>
        </TourTarget>

        {/* Earned so far — split into what's spendable now and what's still maturing. */}
        <TourTarget id="referrals.earned">
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceEyebrow}>{t('referrals.earnedOnInvest')}</Text>
          <Text style={styles.balanceValue}>{money(summary?.earnedTotal ?? 0)}</Text>
          <Text style={styles.balanceHint}>{t('referrals.investOnly')}</Text>
          <View style={styles.balanceSplit}>
            <View style={styles.balancePart}>
              <Text style={[styles.balancePartValue, { color: colors.success }]}>
                {money(summary?.earnedAvailable ?? 0)}
              </Text>
              <Text style={styles.balancePartLabel}>{t('referrals.available')}</Text>
            </View>
            <View style={[styles.balancePart, styles.balancePartRight]}>
              <Text style={[styles.balancePartValue, { color: colors.warning }]}>
                {money(summary?.earnedPending ?? 0)}
              </Text>
              <Text style={styles.balancePartLabel}>{t('referrals.pending')}</Text>
            </View>
          </View>
        </Card>
        </TourTarget>

        <TourTarget id="referrals.stats">
          <StatStrip
            stats={[
              { label: t('referrals.inTree'), value: String(summary?.branchTotal ?? 0) },
              { label: t('referrals.invited'), value: String(summary?.directCount ?? 0) },
              { label: t('referrals.depth'), value: String(summary?.maxDepth ?? 0) },
            ]}
          />
        </TourTarget>

        {/* The ladder, mirroring the numbers the backend actually pays. */}
        <SectionHeader title={t('referrals.ladderTitle')} spaced />
        <TourTarget id="referrals.ladder">
        <ListGroup>
          <ListRow label={t('referrals.ladderNear')} sublabel={t('referrals.ladderNearSub')} value="100 ֏" />
          <ListRow label={t('referrals.ladderFar')} sublabel={t('referrals.ladderFarSub')} value="50 ֏" />
          <ListRow label={t('referrals.ladderDeep')} sublabel={t('referrals.ladderDeepSub')} value="10 ֏" />
          <ListRow label={t('referrals.ladderPercent')} sublabel={t('referrals.ladderPercentSub')} value="1%" />
        </ListGroup>
        </TourTarget>

        {/* Inviting someone into a particular project converts far better than a
            bare invite: the recipient arrives at something concrete. */}
        {projects.length > 0 && (
          <>
            <SectionHeader title={t('referrals.inviteToProjectTitle')} spaced />
            <ListGroup>
              {projects.slice(0, 5).map((project) => (
                <ListRow
                  key={project.id}
                  label={getLocalizedText(project.title, i18n.language)}
                  sublabel={t('referrals.inviteToProjectSub')}
                  right={<Icon name="tag" color={colors.primary} size={16} />}
                  onPress={() => onShareProject(project)}
                />
              ))}
            </ListGroup>
            <Text style={styles.hint}>{t('referrals.inviteToProjectHint')}</Text>
          </>
        )}

        <SectionHeader title={t('referrals.communityTitle')} spaced />
        <ListGroup>
          <ListRow
            icon="users"
            label={t('referrals.treeTitle')}
            sublabel={t('referrals.treeSub', { count: summary?.branchTotal ?? 0 })}
            onPress={() => navigation.navigate('ReferralTree')}
          />
          <ListRow
            icon="history"
            label={t('referrals.earningsTitle')}
            sublabel={t('referrals.earningsSub')}
            onPress={() => navigation.navigate('ReferralEarnings')}
          />
        </ListGroup>

        {/* Blogger door — the partner programme is a separate, higher-rate track.
            This used to render the same "got an audience? apply" pitch forever,
            including to someone whose application was already sitting in the queue
            and to an approved partner. Tapping it opened a screen that said
            something else entirely; no duplicate was created, but nothing told them
            that. The wording now follows where they actually stand. */}
        <Card accented style={styles.bloggerCard}>
          <Text style={styles.bloggerTitle}>{t(`referrals.blogger.${partnerState}Title`)}</Text>
          <Text style={styles.bloggerText}>{t(`referrals.blogger.${partnerState}Text`)}</Text>
          <Pressable style={styles.bloggerButton} onPress={() => navigation.navigate('Partner')}>
            <Text style={styles.bloggerButtonText}>{t(`referrals.blogger.${partnerState}Cta`)}</Text>
          </Pressable>
        </Card>

        <Text style={styles.note}>{t('referrals.noPyramidNote')}</Text>
      </PageContainer>
    </ScrollView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing.md, paddingBottom: spacing.xl },

    codeCard: { alignItems: 'center', backgroundColor: c.primary, borderColor: c.primary },
    codeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' },
    codeEyebrow: { ...typography.eyebrow, color: c.textOnAccentMuted },
    codeValue: { ...typography.display, ...tabularNums, color: c.textOnAccent, letterSpacing: 2, marginVertical: spacing.md },
    codeActions: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' },
    codeButton: {
      flex: 1,
      height: 44,
      borderRadius: radius.lg,
      backgroundColor: c.onOverlayFill,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    codeButtonText: { ...typography.labelStrong, color: c.textOnAccent },

    balanceCard: { alignItems: 'center', marginTop: spacing.md },
    balanceEyebrow: { ...typography.eyebrow, color: c.textMuted },
    balanceValue: { ...typography.display, ...tabularNums, color: c.text, marginTop: spacing.xs },
    balanceHint: { ...typography.micro, color: c.textMuted, marginTop: spacing.xs },
    balanceSplit: {
      flexDirection: 'row',
      alignSelf: 'stretch',
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    balancePart: { flex: 1, alignItems: 'center' },
    balancePartRight: { borderLeftWidth: 1, borderLeftColor: c.border },
    balancePartValue: { ...typography.subheading, ...tabularNums },
    balancePartLabel: { ...typography.micro, color: c.textMuted, marginTop: 2 },

    hint: { ...typography.micro, color: c.textMuted, marginTop: spacing.sm, paddingHorizontal: spacing.xs },

    bloggerCard: { marginTop: spacing.lg },
    bloggerTitle: { ...typography.bodyStrong, color: c.text },
    bloggerText: { ...typography.caption, color: c.textMuted, marginTop: spacing.xs },
    bloggerButton: {
      marginTop: spacing.md,
      height: 44,
      borderRadius: radius.lg,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bloggerButtonText: { ...typography.labelStrong, color: c.textOnAccent },

    note: {
      ...typography.micro,
      color: c.textMuted,
      lineHeight: 18,
      marginTop: spacing.lg,
      padding: spacing.md,
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
    },
  });
