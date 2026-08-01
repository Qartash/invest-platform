import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  focusRing,
  maxWidth,
  PressableState,
  radius,
  spacing,
  ThemeColors,
  typography,
  useTheme,
  useThemeStyles,
} from '../theme';
import { Icon, IconName, PageContainer } from '../components/ui';
import {
  AppNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationPage,
} from '../api/notifications';
import { invalidateQuery, useCachedQuery } from '../api/useCachedQuery';
import { useNotificationsStore } from '../store/notificationsStore';
import { getLocalizedText } from '../utils/localized';
import { formatDateTime, formatMonth } from '../utils/date';
import { navigationRef } from '../navigation/navigationRef';
import { LocalizedText } from '../types';

const PAGE_SIZE = 25;

/**
 * Which glyph a notification gets, decided by what the type is about rather than
 * by listing all fifty. The prefixes are the same groupings the backend's
 * NotificationType is written in, so a type added there picks up a sensible icon
 * without a change here.
 */
function iconFor(type: string): IconName {
  if (type.startsWith('mod_')) return 'shield';
  if (type.startsWith('work_')) return 'briefcase';
  if (type.startsWith('referral_') || type.startsWith('partner_')) return 'users';
  if (type.startsWith('account_')) return 'unlock';
  if (
    type.startsWith('wallet_') ||
    type === 'dividends_received' ||
    type === 'project_funds_withdrawn' ||
    type === 'project_refunded'
  ) {
    return 'wallet';
  }
  if (type.startsWith('project_') || type.startsWith('financial_') || type.startsWith('fund_') ||
      type === 'investment_received' || type === 'tickets_purchased' || type.startsWith('listing_')) {
    return 'layers';
  }
  return 'star';
}

/**
 * Where tapping a notification goes, expressed as a tab plus a screen inside it.
 *
 * Returned as a description rather than navigated to directly because this screen
 * is registered in two different stacks, and neither of them can reach the other's
 * routes on its own — the navigation container is asked to do it.
 */
function targetFor(item: AppNotification): { tab: string; screen: string; params?: object } | null {
  const payload = item.payload ?? {};
  if (item.type.startsWith('wallet_') || item.type === 'referral_earning_paid') {
    return { tab: 'ProfileTab', screen: 'Wallet' };
  }
  if (item.type.startsWith('referral_')) return { tab: 'ProfileTab', screen: 'Referrals' };
  if (item.type.startsWith('partner_')) return { tab: 'ProfileTab', screen: 'Partner' };
  if (item.type === 'quest_rewarded' || item.type === 'streak_rewarded' || item.type === 'daily_draw_won') {
    return { tab: 'ProfileTab', screen: 'Quests' };
  }
  // A work always belongs to a project, and the project's works screen is where
  // both sides of one are actually handled.
  if (typeof payload.projectId === 'string' && (item.type.startsWith('work_') || item.type === 'project_quest_added')) {
    return { tab: 'HomeTab', screen: 'ProjectWorks', params: { projectId: payload.projectId } };
  }
  if (item.type === 'dividends_received' || item.type === 'financial_report_published') {
    return typeof payload.projectId === 'string'
      ? { tab: 'HomeTab', screen: 'ProjectFinance', params: { projectId: payload.projectId } }
      : null;
  }
  if (typeof payload.projectId === 'string') {
    return { tab: 'HomeTab', screen: 'ProjectDetail', params: { projectId: payload.projectId } };
  }
  // Moderation items with nothing more specific attached, and the account ones:
  // there is no single screen they belong to, so they stay put.
  return null;
}

export function NotificationsScreen() {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const setUnread = useNotificationsStore((s) => s.setUnread);

  // Pages after the first are appended here. The first page stays in the query
  // cache so coming back to the screen shows it at once, and pulling to refresh
  // drops the extra pages with it.
  const [extra, setExtra] = useState<AppNotification[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  // Counted rather than derived from how many rows are on screen: a short page —
  // which happens whenever rows shift between requests — would make the division
  // land on the page just fetched and load it a second time.
  const [nextPage, setNextPage] = useState(2);

  const { data, loading, refreshing, refresh } = useCachedQuery<NotificationPage>(
    'notifications',
    useCallback(async () => {
      const page = await fetchNotifications(1, PAGE_SIZE);
      // The list response carries the count, so opening the screen corrects the
      // badge even if the bell's own poll failed.
      setUnread(page.unread);
      return page;
    }, [setUnread]),
  );

  const items = [...(data?.items ?? []), ...extra];
  const total = data?.total ?? 0;

  const reload = useCallback(async () => {
    setExtra([]);
    setExhausted(false);
    setNextPage(2);
    await refresh();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (loadingMore || exhausted || items.length === 0 || items.length >= total) return;
    setLoadingMore(true);
    try {
      const page = await fetchNotifications(nextPage, PAGE_SIZE);
      // A page that comes back empty means there is nothing further to ask for;
      // without this the list would keep asking.
      if (page.items.length === 0) {
        setExhausted(true);
      } else {
        setExtra((current) => [...current, ...page.items]);
        setNextPage((current) => current + 1);
      }
    } catch {
      setExhausted(true);
    } finally {
      setLoadingMore(false);
    }
  }, [exhausted, items.length, loadingMore, nextPage, total]);

  const markLocallyRead = useCallback((id: string) => {
    setExtra((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
  }, []);

  const open = useCallback(
    async (item: AppNotification) => {
      const target = targetFor(item);
      if (!item.read) {
        // Optimistic: the row loses its dot now, and the server is told in the
        // background. A failure leaves the row read on screen and unread on the
        // server, which the next refresh puts right.
        markLocallyRead(item.id);
        setUnread(Math.max(0, useNotificationsStore.getState().unread - 1));
        invalidateQuery('notifications');
        markNotificationRead(item.id)
          .then((unread) => setUnread(unread))
          .catch(() => {});
      }
      if (target && navigationRef.isReady()) {
        (navigationRef.navigate as (name: string, params?: unknown) => void)(target.tab, {
          screen: target.screen,
          params: target.params,
        });
      }
    },
    [markLocallyRead, setUnread],
  );

  const readAll = useCallback(async () => {
    setUnread(0);
    try {
      await markAllNotificationsRead();
    } finally {
      await reload();
    }
  }, [reload, setUnread]);

  const unread = items.filter((item) => !item.read).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PageContainer maxWidth={maxWidth.page}>
        <View style={styles.headerRow}>
          <Text style={styles.header}>{t('notifications.title')}</Text>
          {unread > 0 && (
            <Pressable
              onPress={readAll}
              hitSlop={8}
              style={({ pressed, hovered, focused }: PressableState) => [
                styles.readAll,
                (pressed || hovered) && styles.readAllActive,
                focused && styles.readAllFocused,
              ]}
            >
              <Text style={styles.readAllText}>{t('notifications.markAllRead')}</Text>
            </Pressable>
          )}
        </View>
      </PageContainer>

      {loading ? (
        <ActivityIndicator style={styles.spinner} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.textMuted} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={
            <PageContainer maxWidth={maxWidth.page}>
              <Text style={styles.empty}>{t('notifications.empty')}</Text>
            </PageContainer>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footer} color={colors.textMuted} /> : null
          }
          renderItem={({ item }) => (
            <PageContainer maxWidth={maxWidth.page}>
              <NotificationRow item={item} onPress={() => open(item)} />
            </PageContainer>
          )}
        />
      )}
    </View>
  );
}

function NotificationRow({ item, onPress }: { item: AppNotification; onPress: () => void }) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();

  const params = buildParams(item, i18n.language, t);
  // An array of keys is i18next's own fallback chain: a type this build has no
  // wording for is shown as a generic line instead of the raw key.
  const title = t([`notifications.items.${item.type}.title`, 'notifications.items.unknown.title'], params);
  const body = t([`notifications.items.${item.type}.body`, 'notifications.items.unknown.body'], params);
  const tappable = !!targetFor(item);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={tappable ? 'button' : 'text'}
      style={({ pressed, hovered, focused }: PressableState) => [
        styles.row,
        !item.read && styles.rowUnread,
        (pressed || hovered) && styles.rowActive,
        focused && styles.rowFocused,
      ]}
    >
      <View style={[styles.plaque, !item.read && styles.plaqueUnread]}>
        <Icon name={iconFor(item.type)} color={item.read ? colors.textMuted : colors.primary} size={17} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, !item.read && styles.rowTitleUnread]}>{title}</Text>
        <Text style={styles.rowText}>{body}</Text>
        <Text style={styles.rowTime}>{formatDateTime(item.createdAt, i18n.language)}</Text>
      </View>
      {!item.read && <View style={styles.dot} />}
    </Pressable>
  );
}

/**
 * Turns a payload into the values the sentence interpolates.
 *
 * Everything is given a defined value, blanks included: i18next prints the raw
 * `{{placeholder}}` for a missing one, and an old notification whose payload
 * predates a wording change would otherwise show it.
 */
function buildParams(
  item: AppNotification,
  language: string,
  // Only ever called with a plain key — the currency symbol, a risk label, the
  // placeholder for a project with no title — so it does not need i18next's full
  // overloaded signature.
  t: (key: string) => string,
): Record<string, string | number> {
  const payload = item.payload ?? {};
  const money = (value: unknown) =>
    typeof value === 'number' ? `${value.toLocaleString()} ${t('common.currency')}` : '—';

  const projectTitle =
    typeof payload.projectTitle === 'string'
      ? payload.projectTitle
      : getLocalizedText((payload.projectTitle as LocalizedText | undefined) ?? undefined, language);

  return {
    project: projectTitle || t('notifications.aProject'),
    work: (payload.workTitle as string) || '',
    stage: (payload.stageTitle as string) || '',
    quest: (payload.questTitle as string) || '',
    milestone: (payload.milestoneTitle as string) || '',
    amount: money(payload.amount),
    balance: money(payload.balance),
    offeredPrice: money(payload.offeredPrice),
    quantity: typeof payload.quantity === 'number' ? payload.quantity : 0,
    count: typeof payload.count === 'number' ? payload.count : 0,
    partners: typeof payload.partners === 'number' ? payload.partners : 0,
    rating: typeof payload.rating === 'number' ? payload.rating : 0,
    streak: typeof payload.streak === 'number' ? payload.streak : 0,
    level: typeof payload.level === 'number' ? payload.level : 0,
    ticketsIssued: typeof payload.ticketsIssued === 'number' ? payload.ticketsIssued : 0,
    ticketsHeld: typeof payload.ticketsHeld === 'number' ? payload.ticketsHeld : 0,
    period: typeof payload.period === 'string' ? formatMonth(payload.period, language) : '',
    risk: typeof payload.riskLevel === 'string' ? t(`project.risk.${payload.riskLevel}`) : '',
    comment: (payload.comment as string) || '',
    actor: (payload.actorName as string) || '',
    fields: Array.isArray(payload.fields) ? (payload.fields as string[]).join(', ') : '',
  };
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    header: {
      ...typography.display,
      color: c.text,
      flexShrink: 1,
    },
    readAll: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    readAllActive: {
      backgroundColor: c.primarySoft,
    },
    readAllFocused: focusRing(c),
    readAllText: {
      ...typography.micro,
      color: c.primary,
    },
    spinner: {
      marginTop: spacing.xl,
    },
    footer: {
      marginVertical: spacing.md,
    },
    list: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xs,
    },
    empty: {
      ...typography.caption,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: spacing.xl,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: spacing.md - 2,
      marginBottom: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    // Read rows stay legible but stop competing: an unread one carries the tinted
    // plaque, the heavier title and the dot.
    rowUnread: {
      borderColor: c.primary,
    },
    rowActive: {
      backgroundColor: c.primarySoft,
    },
    rowFocused: focusRing(c),
    plaque: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: c.surfaceSunken,
      alignItems: 'center',
      justifyContent: 'center',
    },
    plaqueUnread: {
      backgroundColor: c.primarySoft,
    },
    rowBody: {
      flex: 1,
    },
    rowTitle: {
      ...typography.label,
      color: c.text,
    },
    rowTitleUnread: {
      fontWeight: typography.labelStrong.fontWeight,
    },
    rowText: {
      ...typography.caption,
      color: c.textMuted,
      lineHeight: 19,
      marginTop: 2,
    },
    rowTime: {
      ...typography.micro,
      color: c.textMuted,
      marginTop: spacing.xs,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: radius.pill,
      backgroundColor: c.primary,
      marginTop: 6,
    },
  });
