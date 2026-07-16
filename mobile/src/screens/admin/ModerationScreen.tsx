import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { fetchAllProjectsForModeration, fetchPendingDeletions, fetchPendingProjects } from '../../api/projects';
import { fetchAllUsers } from '../../api/users';
import { resolveMediaUrl } from '../../api/client';
import { AuthUser, Project } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import { priorityColors } from '../../utils/priority';
import { Avatar } from '../../components/Avatar';
import { formatDate } from '../../utils/date';
import { spacing, ThemeColors, useThemeStyles, useTheme } from '../../theme';
import { ModerationStackParamList } from '../../navigation/ModerationNavigator';
import { LogsScreen } from './LogsScreen';
import { ModerationReleasesScreen } from './ModerationReleasesScreen';
import { ModerationDisputesScreen } from './ModerationDisputesScreen';

type Props = NativeStackScreenProps<ModerationStackParamList, 'ModerationList'>;

type Tab = 'pending' | 'all' | 'users' | 'releases' | 'disputes' | 'logs';

// "deleted" is not a ProjectStatus — it's a soft-delete flag (deletedAt), shown
// and filtered here as if it were a status because that's how moderators think.
type StatusFilter = 'all' | 'pending_review' | 'active' | 'funded' | 'draft' | 'closed' | 'rejected' | 'deleted';

const STATUS_FILTERS: StatusFilter[] = ['all', 'pending_review', 'active', 'funded', 'draft', 'closed', 'rejected', 'deleted'];

// Project status -> colour, built per palette so the badges follow the theme.
const statusColors = (c: ThemeColors): Record<string, string> => ({
  draft: c.textMuted,
  pending_review: c.warning,
  active: c.success,
  funded: c.chartAccent,
  closed: c.textMuted,
  rejected: c.danger,
  deleted: c.danger,
});

function displayStatus(project: Project): string {
  return project.deletedAt ? 'deleted' : project.status;
}

export function ModerationScreen({ navigation }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const PRIORITY_COLORS = useMemo(() => priorityColors(colors), [colors]);
  const STATUS_COLORS = useMemo(() => statusColors(colors), [colors]);
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>('pending');
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
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

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      setUsers(await fetchAllUsers());
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
      if (tab === 'users') loadUsers();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, loadAll, loadUsers, tab]),
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
      <Pressable style={[styles.tab, tab === 'users' && styles.tabActive]} onPress={() => setTab('users')}>
        <Text style={[styles.tabText, tab === 'users' && styles.tabTextActive]}>{t('moderation.users.title')}</Text>
      </Pressable>
      <Pressable style={[styles.tab, tab === 'releases' && styles.tabActive]} onPress={() => setTab('releases')}>
        <Text style={[styles.tabText, tab === 'releases' && styles.tabTextActive]}>{t('moderation.releases.tab')}</Text>
      </Pressable>
      <Pressable style={[styles.tab, tab === 'disputes' && styles.tabActive]} onPress={() => setTab('disputes')}>
        <Text style={[styles.tabText, tab === 'disputes' && styles.tabTextActive]}>{t('works.disputesTab')}</Text>
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

  if (tab === 'releases') {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>{t('founder.moderation')}</Text>
        {tabSwitcher}
        <ModerationReleasesScreen />
      </View>
    );
  }

  if (tab === 'disputes') {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>{t('founder.moderation')}</Text>
        {tabSwitcher}
        <ModerationDisputesScreen />
      </View>
    );
  }

  if (tab === 'users') {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>{t('founder.moderation')}</Text>
        {tabSwitcher}
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => navigation.navigate('ModerationUser', { userId: item.id })}>
              <Avatar avatarUrl={item.avatarUrl} avatarEmoji={item.avatarEmoji} size={44} />
              <View style={[styles.cardText, styles.userCardText]}>
                <View style={styles.badgeRow}>
                  <View style={styles.editBadge}>
                    <Text style={styles.editBadgeText}>{t(`moderation.users.roles.${item.role}`)}</Text>
                  </View>
                  {item.bannedAt && (
                    <View style={styles.deletionBadge}>
                      <Text style={styles.deletionBadgeText}>{t('moderation.users.bannedBadge')}</Text>
                    </View>
                  )}
                  {item.deletedAt && (
                    <View style={styles.deletionBadge}>
                      <Text style={styles.deletionBadgeText}>{t('project.status.deleted')}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.title}>{item.fullName || item.username || '—'}</Text>
                <Text style={styles.meta}>
                  {item.username ? `@${item.username}` : ''}
                  {item.createdAt ? ` · ${formatDate(item.createdAt, i18n.language)}` : ''}
                </Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>{loadFailed ? t('common.error') : t('reports.noData')}</Text>
            ) : null
          }
        />
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

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      fontSize: 24,
      fontWeight: '700',
      color: c.text,
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
      borderBottomColor: c.border,
      alignItems: 'center',
    },
    tabActive: {
      borderBottomColor: c.primary,
    },
    tabText: {
      color: c.textMuted,
      fontWeight: '600',
    },
    tabTextActive: {
      color: c.primary,
    },
    filterRow: {
      flexGrow: 0,
      // Without flexShrink 0 the overflowing FlatList below makes flexbox
      // shrink this row to a sliver, clipping the chips.
      flexShrink: 0,
      height: 44,
      marginBottom: spacing.xs,
    },
    filterRowContent: {
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
    },
    filterChip: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 999,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      marginRight: spacing.sm,
      backgroundColor: c.surface,
    },
    filterChipActive: {
      borderColor: c.primary,
      backgroundColor: c.primary,
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textMuted,
    },
    filterChipTextActive: {
      color: c.surface,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      backgroundColor: c.background,
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
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    cover: {
      width: 56,
      height: 56,
      borderRadius: 8,
      marginRight: spacing.md,
      backgroundColor: c.border,
    },
    coverPlaceholder: {
      borderWidth: 1,
      borderColor: c.border,
    },
    cardText: {
      flex: 1,
    },
    userCardText: {
      marginLeft: spacing.md,
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
      backgroundColor: c.background,
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
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      marginRight: spacing.xs,
    },
    editBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: c.primary,
    },
    deletionBadge: {
      alignSelf: 'flex-start',
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      marginRight: spacing.xs,
    },
    deletionBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: c.danger,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
      marginBottom: 2,
    },
    founder: {
      fontSize: 12,
      color: c.textMuted,
      marginBottom: 2,
    },
    meta: {
      fontSize: 12,
      color: c.textMuted,
    },
    empty: {
      textAlign: 'center',
      color: c.textMuted,
      marginTop: spacing.xl,
    },
  });
