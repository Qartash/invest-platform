import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { fetchAllProjectsForModeration, fetchPendingDeletions, fetchPendingProjects } from '../../api/projects';
import { fetchAllUsers } from '../../api/users';
import { useCachedQuery } from '../../api/useCachedQuery';
import { resolveMediaUrl } from '../../api/client';
import { AuthUser, Project } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import { priorityColors } from '../../utils/priority';
import { Avatar } from '../../components/Avatar';
import { Icon, IconName, PageContainer, useGrid } from '../../components/ui';
import { formatDate } from '../../utils/date';
import {
  maxWidth,
  spacing,
  ThemeColors,
  typography,
  useBreakpoint,
  useThemeStyles,
  useTheme,
} from '../../theme';
import { HelpButton, TourTarget, useAutoTour } from '../../onboarding';
import { ModerationStackParamList } from '../../navigation/ModerationNavigator';
import { LogsScreen } from './LogsScreen';
import { ModerationReleasesScreen } from './ModerationReleasesScreen';
import { ModerationDisputesScreen } from './ModerationDisputesScreen';
import { ModerationPartnersScreen } from './ModerationPartnersScreen';

type Props = NativeStackScreenProps<ModerationStackParamList, 'ModerationList'>;

type Tab = 'pending' | 'all' | 'users' | 'partners' | 'releases' | 'disputes' | 'logs';

// Seven destinations do not fit as text on a phone — the labels used to overlap each
// other. The row is icons only, with the active one's name spelled out underneath so
// the screen still says where you are.
const TABS: Array<{ key: Tab; icon: IconName; labelKey: string }> = [
  { key: 'pending', icon: 'clock', labelKey: 'moderation.tabPending' },
  { key: 'all', icon: 'layers', labelKey: 'moderation.tabAll' },
  { key: 'users', icon: 'users', labelKey: 'moderation.users.title' },
  { key: 'partners', icon: 'star', labelKey: 'partners.admin.tab' },
  { key: 'releases', icon: 'unlock', labelKey: 'moderation.releases.tab' },
  { key: 'disputes', icon: 'flag', labelKey: 'works.disputesTab' },
  { key: 'logs', icon: 'history', labelKey: 'moderation.logs.title' },
];

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
  const { isCompact } = useBreakpoint();
  const [tab, setTab] = useState<Tab>('pending');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // One query per tab, each fetched only while its own tab is showing — the same rule the
  // three loaders enforced by hand, except a tab already visited now redraws from what it
  // last saw instead of emptying itself to fetch again. Moderating something invalidates
  // the `projects:` prefix these live under, so a decision is never held on screen.
  const queueQuery = useCachedQuery<Project[]>(
    'projects:moderation:queue',
    useCallback(async () => {
      const [pendingReview, pendingDeletions] = await Promise.all([fetchPendingProjects(), fetchPendingDeletions()]);
      return [...pendingDeletions, ...pendingReview];
    }, []),
    { enabled: tab === 'pending' },
  );
  const allQuery = useCachedQuery<Project[]>('projects:moderation:all', fetchAllProjectsForModeration, {
    enabled: tab === 'all',
  });
  const usersQuery = useCachedQuery<AuthUser[]>('users:all', fetchAllUsers, { enabled: tab === 'users' });

  const activeQuery = tab === 'all' ? allQuery : tab === 'users' ? usersQuery : queueQuery;

  // Seven destinations behind seven unlabelled glyphs — the one screen in the app where a
  // first visit genuinely needs a map.
  useAutoTour('admin');

  const projects = useMemo(() => queueQuery.data ?? [], [queueQuery.data]);
  const allProjects = useMemo(() => allQuery.data ?? [], [allQuery.data]);
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const loading = activeQuery.loading;
  const loadFailed = !activeQuery.data && !!activeQuery.error;

  const filteredAll = useMemo(() => {
    if (statusFilter === 'all') return allProjects;
    // The "pending review" chip means "waiting on me", not "carries this status".
    // A live project with a proposed edit keeps its own status — funded stays
    // funded — but the decision is still the moderator's to make, so it belongs
    // under this chip too.
    if (statusFilter === 'pending_review') {
      return allProjects.filter((p) => !p.deletedAt && (p.status === 'pending_review' || p.pendingChanges));
    }
    return allProjects.filter((p) => displayStatus(p) === statusFilter);
  }, [allProjects, statusFilter]);

  const activeTab = TABS.find((item) => item.key === tab) ?? TABS[0];

  // Both lists are computed above the early returns below, because the grids they feed are
  // built by a hook and a hook cannot sit behind a conditional return.
  const isAllTab = tab === 'all';
  const listData = isAllTab ? filteredAll : projects;
  // Two columns, not three: these rows are a thumbnail beside a stack of badges, and the
  // badges start wrapping onto extra lines as soon as the row gets narrower than this.
  const { columns, data: projectCells, isGrid } = useGrid(listData, { medium: 2, wide: 2 });
  const { columns: userColumns, data: userCells, isGrid: usersGrid } = useGrid(users, { medium: 2, wide: 2 });

  const tabSwitcher = (
    <TourTarget id="admin.tabs" style={styles.tabBlock} key="tabs">
      <View style={styles.tabRow}>
        {TABS.map((item) => {
          const active = item.key === tab;
          return (
            <Pressable
              key={item.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              // The glyph carries no text, so the label has to reach assistive tech somehow.
              accessibilityLabel={t(item.labelKey)}
            >
              <Icon name={item.icon} color={active ? colors.primary : colors.textMuted} size={20} />
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.tabCaption}>{t(activeTab.labelKey)}</Text>
    </TourTarget>
  );

  // Every tab below repeats the same title and switcher; capping them once here keeps the
  // six destinations from drifting apart from each other in a wide window.
  const head = (
    <PageContainer maxWidth={maxWidth.page}>
      <TourTarget id="admin.queue" style={styles.headerRow}>
        <Text style={styles.header}>{t('founder.moderation')}</Text>
        <HelpButton topic="admin" tour="admin" />
      </TourTarget>
      {tabSwitcher}
    </PageContainer>
  );

  if (tab === 'logs') {
    return (
      <View style={styles.container}>
        {head}
        <LogsScreen />
      </View>
    );
  }

  if (tab === 'releases') {
    return (
      <View style={styles.container}>
        {head}
        <ModerationReleasesScreen />
      </View>
    );
  }

  if (tab === 'disputes') {
    return (
      <View style={styles.container}>
        {head}
        <ModerationDisputesScreen />
      </View>
    );
  }

  if (tab === 'partners') {
    return (
      <View style={styles.container}>
        {head}
        <ModerationPartnersScreen />
      </View>
    );
  }

  // Both renderers hand back the bare card in one column and wrap it in an equal-share cell
  // in a grid — the wrapper exists only to divide a row, so a phone never grows one.
  const renderUserCard = ({ item }: { item: AuthUser | null }) => {
    if (!item) return <View style={styles.cell} />;
    const card = (
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
    );
    return usersGrid ? <View style={styles.cell}>{card}</View> : card;
  };

  if (tab === 'users') {
    return (
      <View style={styles.container}>
        {head}
        <FlatList
          key={userColumns}
          numColumns={userColumns}
          columnWrapperStyle={usersGrid ? styles.row : undefined}
          data={userCells}
          keyExtractor={(item, index) => item?.id ?? `filler-${index}`}
          contentContainerStyle={[styles.list, !isCompact && styles.listWide]}
          renderItem={renderUserCard}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>{loadFailed ? t('common.error') : t('reports.noData')}</Text>
            ) : null
          }
        />
      </View>
    );
  }

  const renderCard = ({ item }: { item: Project | null }) => {
    if (!item) return <View style={styles.cell} />;
    const status = displayStatus(item);
    const card = (
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
    return isGrid ? <View style={styles.cell}>{card}</View> : card;
  };

  return (
    <View style={styles.container}>
      {head}
      {isAllTab && (
        <PageContainer maxWidth={maxWidth.page}>
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
        </PageContainer>
      )}
      <FlatList
        key={columns}
        numColumns={columns}
        columnWrapperStyle={isGrid ? styles.row : undefined}
        data={projectCells}
        keyExtractor={(item, index) => item?.id ?? `filler-${index}`}
        contentContainerStyle={[styles.list, !isCompact && styles.listWide]}
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
    // The help button shares the title's line, so the title's own padding moved onto the row.
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      padding: spacing.lg,
      paddingBottom: spacing.sm,
    },
    header: {
      fontSize: 24,
      fontWeight: '700',
      color: c.text,
      flexShrink: 1,
    },
    tabBlock: {
      marginBottom: spacing.sm,
    },
    tabRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
    },
    tab: {
      flex: 1,
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: 2,
      borderBottomColor: c.border,
      alignItems: 'center',
    },
    tabActive: {
      borderBottomColor: c.primary,
    },
    tabCaption: {
      ...typography.captionStrong,
      color: c.primary,
      textAlign: 'center',
      marginTop: spacing.xs + 2,
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
    listWide: {
      maxWidth: maxWidth.page,
      width: '100%',
      alignSelf: 'center',
    },
    row: {
      gap: spacing.sm,
    },
    cell: {
      flex: 1,
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
