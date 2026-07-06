import React, { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { fetchPendingDeletions, fetchPendingProjects } from '../../api/projects';
import { resolveMediaUrl } from '../../api/client';
import { Project } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import { PRIORITY_COLORS } from '../../utils/priority';
import { colors, spacing } from '../../theme';
import { ModerationStackParamList } from '../../navigation/ModerationNavigator';
import { LogsScreen } from './LogsScreen';

type Props = NativeStackScreenProps<ModerationStackParamList, 'ModerationList'>;

type Tab = 'pending' | 'logs';

export function ModerationScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>('pending');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingReview, pendingDeletions] = await Promise.all([fetchPendingProjects(), fetchPendingDeletions()]);
      setProjects([...pendingDeletions, ...pendingReview]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (tab === 'pending') load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, tab]),
  );

  const tabSwitcher = (
    <View style={styles.tabRow}>
      <Pressable style={[styles.tab, tab === 'pending' && styles.tabActive]} onPress={() => setTab('pending')}>
        <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>{t('moderation.tabPending')}</Text>
      </Pressable>
      <Pressable style={[styles.tab, tab === 'logs' && styles.tabActive]} onPress={() => setTab('logs')}>
        <Text style={[styles.tabText, tab === 'logs' && styles.tabTextActive]}>{t('moderation.logs.title')}</Text>
      </Pressable>
    </View>
  );

  if (tab === 'logs') {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>{t('founder.moderation')}</Text>
        {tabSwitcher}
        <LogsScreen />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('founder.moderation')}</Text>
      {tabSwitcher}
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('ModerationDetail', { projectId: item.id })}
          >
            {item.coverImageUrl ? (
              <Image source={{ uri: resolveMediaUrl(item.coverImageUrl) }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverPlaceholder]} />
            )}
            <View style={styles.cardText}>
              <View style={styles.badgeRow}>
                {item.deletionRequestedAt ? (
                  <View style={styles.deletionBadge}>
                    <Text style={styles.deletionBadgeText}>{t('founder.deletionRequestBadge')}</Text>
                  </View>
                ) : (
                  item.pendingChanges && (
                    <View style={styles.editBadge}>
                      <Text style={styles.editBadgeText}>{t('founder.pendingChangesBadge')}</Text>
                    </View>
                  )
                )}
                <View style={[styles.priorityBadge, { borderColor: PRIORITY_COLORS[item.priority] }]}>
                  <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[item.priority] }]} />
                  <Text style={[styles.priorityBadgeText, { color: PRIORITY_COLORS[item.priority] }]}>
                    {t(`project.priority.${item.priority}`)}
                  </Text>
                </View>
              </View>
              <Text style={styles.title}>{getLocalizedText(item.title, i18n.language)}</Text>
              {item.founderName && <Text style={styles.founder}>{item.founderName}</Text>}
              <Text style={styles.meta}>
                {parseFloat(item.targetAmount).toLocaleString()} {t('common.currency')} · {item.totalTickets}{' '}
                {t('founder.totalTickets').toLowerCase()}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>{t('founder.noPendingProjects')}</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.primary,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cover: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: spacing.md,
    backgroundColor: colors.border,
  },
  coverPlaceholder: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardText: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginRight: spacing.xs,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  editBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginRight: spacing.xs,
  },
  editBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  deletionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginRight: spacing.xs,
  },
  deletionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.danger,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  founder: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.xl,
  },
});
