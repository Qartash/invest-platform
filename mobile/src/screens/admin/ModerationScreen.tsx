import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { fetchAllProjectsForModeration, fetchPendingDeletions, fetchPendingProjects } from '../../api/projects';
import { resolveMediaUrl } from '../../api/client';
import { Project } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import { PRIORITY_COLORS } from '../../utils/priority';
import { colors, spacing } from '../../theme';
import { ModerationStackParamList } from '../../navigation/ModerationNavigator';
import { LogsScreen } from './LogsScreen';

type Props = NativeStackScreenProps<ModerationStackParamList, 'ModerationList'>;

type Tab = 'pending' | 'all' | 'logs';

// "deleted" is not a ProjectStatus — it's a soft-delete flag (deletedAt), shown
// and filtered here as if it were a status because that's how moderators think.
type StatusFilter = 'all' | 'pending_review' | 'active' | 'funded' | 'draft' | 'closed' | 'rejected' | 'deleted';

const STATUS_FILTERS: StatusFilter[] = ['all', 'pending_review', 'active', 'funded', 'draft', 'closed', 'rejected', 'deleted'];

const STATUS_COLORS: Record<string, string> = {
  draft: colors.textMuted,
  pending_review: colors.warning,
  active: colors.success,
  funded: colors.chartAccent,
  closed: colors.textMuted,
  rejected: colors.danger,
  deleted: colors.danger,
};

function displayStatus(project: Project): string {
  return project.deletedAt ? 'deleted' : project.status;
}

export function ModerationScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>('pending');
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [pendingReview, pendingDeletions] = await Promise.all([fetchPendingProjects(), fetchPendingDeletions()]);
      setProjects([...pendingDeletions, ...pendingReview]);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      setAllProjects(await fetchAllProjectsForModeration());
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (tab === 'pending') load();
      if (tab === 'all') loadAll();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, loadAll, tab]),
  );

  const filteredAll = useMemo(() => {
    if (statusFilter === 'all') return allProjects;
    return allProjects.filter((p) => displayStatus(p) === statusFilter);
  }, [allProjects, statusFilter]);

  const tabSwitcher = (
    <View style={styles.tabRow}>
      <Pressable style={[styles.tab, tab === 'pending' && styles.tabActive]} onPress={() => setTab('pending')}>
        <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>{t('moderation.tabPending')}</Text>
      </Pressable>
      <Pressable style={[styles.tab, tab === 'all' && styles.tabActive]} onPress={() => setTab('all')}>
        <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>{t('moderation.tabAll')}</Text>
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

  const isAllTab = tab === 'all';
  const listData = isAllTab ? filteredAll : projects;

  const renderCard = ({ item }: { item: Project }) => {
    const status = displayStatus(item);
    return (
      <Pressable style={styles.card} onPress={() => navigation.navigate('ModerationDetail', { projectId: item.id })}>
        {item.coverImageUrl ? (
          <Image source={{ uri: resolveMediaUrl(item.coverImageUrl) }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]} />
        )}
        <View style={styles.cardText}>
          <View style={styles.badgeRow}>
            {isAllTab && (
              <View style={[styles.statusBadge, { borderColor: STATUS_COLORS[status] }]}>
                <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[status] }]}>
                  {t(`project.status.${status}`)}
                </Text>
              </View>
            )}
            {item.deletionRequestedAt && !item.deletedAt ? (
              <View style={styles.deletionBadge}>
                <Text style={styles.deletionBadgeText}>{t('founder.deletionRequestBadge')}</Text>
              </View>
            ) : (
              item.pendingChanges &&
              !item.deletedAt && (
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
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('founder.moderation')}</Text>
      {tabSwitcher}
      {isAllTab && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
          {STATUS_FILTERS.map((status) => {
            const active = statusFilter === status;
            return (
              <Pressable
                key={status}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setStatusFilter(status)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {status === 'all' ? t('moderation.filterAll') : t(`project.status.${status}`)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderCard}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>{loadFailed ? t('common.error') : t('founder.noPendingProjects')}</Text>
          ) : null
        }
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
  filterRow: {
    flexGrow: 0,
    marginBottom: spacing.sm,
  },
  filterRowContent: {
    paddingHorizontal: spacing.lg,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginRight: spacing.xs,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterChipTextActive: {
    color: colors.surface,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginRight: spacing.xs,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
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
