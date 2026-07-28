import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { maxWidth, radius, spacing, tabularNums, ThemeColors, typography, useTheme, useThemeStyles } from '../../theme';
import { Card, PageContainer, Pill, SectionHeader } from '../../components/ui';
import { completeQuest, DailyBonus, fetchDailyBonus, fetchQuests, Quest } from '../../api/quests';
import { checkIn, StreakState } from '../../api/activity';
import { invalidateQuery, useCachedQuery } from '../../api/useCachedQuery';
import { getLocalizedText } from '../../utils/localized';
import { showAlert } from '../../utils/alert';
import { LoadFailed } from '../../components/LoadFailed';
import { HelpButton, TourTarget } from '../../onboarding';

export function QuestsScreen() {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const [streak, setStreak] = useState<StreakState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // The quest list is what this screen is for, so only its failure blanks the screen — and
  // only while there is no cached copy to show instead. The bonus is an occasional extra,
  // worth caching beside it but never worth replacing the page over.
  const { data: fetchedQuests, error: questsError, refresh: refreshQuests } = useCachedQuery<Quest[]>(
    'quests:list',
    fetchQuests,
  );
  const { data: bonus, refresh: refreshBonus } = useCachedQuery<DailyBonus>('quests:bonus', fetchDailyBonus);

  const quests = fetchedQuests ?? [];
  const loadFailed = !fetchedQuests && !!questsError;

  const load = useCallback(() => {
    void refreshQuests();
    void refreshBonus();
  }, [refreshQuests, refreshBonus]);

  // Opening the quests screen is itself a visit, so the streak counts it. Deliberately not
  // cached: it is a write as much as a read, and its answer is what the check-in just did.
  useFocusEffect(
    useCallback(() => {
      checkIn()
        .then(setStreak)
        .catch(() => {});
    }, []),
  );

  const money = (v: number) => `${v.toLocaleString()} ${t('common.currency')}`;

  // Platform quests are translated from their key; project quests show whatever
  // the founder wrote.
  const questTitle = (q: Quest) =>
    q.key ? t(`quests.catalog.${q.key}.title`) : (q.title ?? '');
  const questText = (q: Quest) =>
    q.key ? t(`quests.catalog.${q.key}.description`) : (q.description ?? '');

  const onComplete = async (q: Quest) => {
    setBusyId(q.id);
    try {
      const res = await completeQuest(q.id);
      showAlert(t('quests.rewarded'), money(res.awarded));
      // The reward lands in the wallet, so whatever balance other screens are holding is
      // now short by it.
      invalidateQuery('wallet');
      load();
    } catch {
      showAlert(t('quests.notYetTitle'), t('quests.notYetText'));
    } finally {
      setBusyId(null);
    }
  };

  const platform = quests.filter((q) => q.scope === 'platform');
  const project = quests.filter((q) => q.scope === 'project');
  const target = streak?.target ?? 7;
  const days = streak?.streak ?? 0;
  // Where the current week sits: a finished week shows as full rather than empty,
  // because `days % target` is 0 both at zero days and at exactly one week.
  const inCycle = days % target;
  const lit = days > 0 && inCycle === 0 ? target : inCycle;
  const daysLeft = target - lit;

  const renderQuest = (q: Quest) => {
    const canPress = !q.completed && q.verification !== 'admin' && (q.verification !== 'auto' || q.eligible);
    return (
      <Card key={q.id} style={q.completed ? { ...styles.quest, ...styles.questDone } : styles.quest}>
        <View style={styles.questTop}>
          <View style={styles.questMain}>
            <Text style={styles.questTitle}>{questTitle(q)}</Text>
            {!!questText(q) && <Text style={styles.questText}>{questText(q)}</Text>}
            {!!q.projectTitle && (
              <Text style={styles.questProject}>{getLocalizedText(q.projectTitle, i18n.language)}</Text>
            )}
          </View>
          <Text style={[styles.questReward, q.completed && { color: colors.success }]}>
            {q.completed ? `+${q.completedAmount.toLocaleString()}` : q.reward.toLocaleString()} ֏
          </Text>
        </View>

        <View style={styles.questFoot}>
          {q.completed ? (
            <Pill label={t('quests.done')} tone="success" />
          ) : q.verification === 'admin' ? (
            <Pill label={t('quests.byModerator')} tone="neutral" />
          ) : canPress ? (
            <Pressable
              style={styles.questButton}
              onPress={() => onComplete(q)}
              disabled={busyId === q.id}
            >
              <Text style={styles.questButtonText}>
                {q.verification === 'client' ? t('quests.markDone') : t('quests.claim')}
              </Text>
            </Pressable>
          ) : (
            <Pill label={t('quests.notEligible')} tone="warning" />
          )}
        </View>
      </Card>
    );
  };

  if (loadFailed) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <PageContainer maxWidth={maxWidth.column}>
          <LoadFailed onRetry={load} />
        </PageContainer>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageContainer maxWidth={maxWidth.column}>
        {/* Streak — the same seven days that also qualify a referral. */}
        <TourTarget id="quests.bonus">
        <Card>
          <View style={styles.streakHead}>
            <Text style={styles.streakTitle}>{t('quests.streakTitle')}</Text>
            <View style={styles.streakRight}>
              <Text style={styles.streakCount}>
                {days} / {target}
              </Text>
              <HelpButton topic="quests" tour="referrals" />
            </View>
          </View>
          <View style={styles.streakRow}>
            {Array.from({ length: target }, (_, i) => (
              <View key={i} style={[styles.streakDay, i < lit && styles.streakDayOn]}>
                <Text style={[styles.streakDayText, i < lit && styles.streakDayTextOn]}>{i + 1}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.streakHint}>{t('quests.streakHint', { count: daysLeft })}</Text>
        </Card>
        </TourTarget>

        {/* The draw that stands in for attributing a code-less sign-up to a stranger. */}
        {bonus && bonus.wonToday > 0 && (
          <Card accented style={styles.bonusCard}>
            <Text style={styles.bonusTitle}>{t('quests.dailyBonusWonTitle')}</Text>
            <Text style={styles.bonusText}>
              {t('quests.dailyBonusWonText', { count: bonus.organicArrivals, pool: bonus.pool })}
            </Text>
            <Text style={styles.bonusAmount}>+{bonus.wonToday.toLocaleString()} ֏</Text>
          </Card>
        )}

        {project.length > 0 && (
          <>
            <SectionHeader title={t('quests.fromProjects')} spaced />
            {project.map(renderQuest)}
            <Text style={styles.note}>{t('quests.fromProjectsNote')}</Text>
          </>
        )}

        <SectionHeader title={t('quests.fromPlatform')} spaced />
        <TourTarget id="quests.list">{platform.map(renderQuest)}</TourTarget>

        <Text style={styles.note}>{t('quests.investCreditNote')}</Text>
      </PageContainer>
    </ScrollView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing.md, paddingBottom: spacing.xl },

    streakHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    streakRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    streakTitle: { ...typography.captionStrong, color: c.text },
    streakCount: { ...typography.captionStrong, ...tabularNums, color: c.success },
    streakRow: { flexDirection: 'row', gap: spacing.xs + 1, marginTop: spacing.sm },
    streakDay: {
      flex: 1,
      height: 30,
      borderRadius: radius.sm,
      backgroundColor: c.surfaceSunken,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    streakDayOn: { backgroundColor: c.primary, borderColor: 'transparent' },
    streakDayText: { ...typography.microStrong, color: c.textMuted },
    streakDayTextOn: { color: c.textOnAccent },
    streakHint: { ...typography.micro, color: c.textMuted, marginTop: spacing.sm },

    bonusCard: { marginTop: spacing.md, alignItems: 'center' },
    bonusTitle: { ...typography.bodyStrong, color: c.text },
    bonusText: { ...typography.caption, color: c.textMuted, textAlign: 'center', marginTop: spacing.xs },
    bonusAmount: { ...typography.title, ...tabularNums, color: c.success, marginTop: spacing.sm },

    quest: { marginBottom: spacing.sm },
    questDone: { opacity: 0.6 },
    questTop: { flexDirection: 'row', gap: spacing.md },
    questMain: { flex: 1, minWidth: 0 },
    questTitle: { ...typography.bodyStrong, color: c.text },
    questText: { ...typography.caption, color: c.textMuted, marginTop: 2, lineHeight: 18 },
    questProject: { ...typography.micro, color: c.primary, marginTop: spacing.xs },
    questReward: { ...typography.bodyStrong, ...tabularNums, color: c.primary },
    questFoot: { marginTop: spacing.md, flexDirection: 'row' },
    questButton: {
      height: 38,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    questButtonText: { ...typography.labelStrong, color: c.textOnAccent },

    note: {
      ...typography.micro,
      color: c.textMuted,
      lineHeight: 18,
      marginTop: spacing.md,
      padding: spacing.md,
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
    },
  });
