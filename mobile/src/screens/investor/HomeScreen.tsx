import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProjectCard } from '../../components/ProjectCard';
import { PageContainer, SegmentedTabs, useGrid } from '../../components/ui';
import { fetchProjects } from '../../api/projects';
import { useCachedQuery } from '../../api/useCachedQuery';
import { Project } from '../../types';
import { maxWidth, spacing, ThemeColors, typography, useBreakpoint, useTheme, useThemeStyles } from '../../theme';
import { HelpButton, TourTarget } from '../../onboarding';
import { NotificationBell } from '../../components/NotificationBell';
import { InvestorHomeStackParamList } from '../../navigation/InvestorNavigator';

type Props = NativeStackScreenProps<InvestorHomeStackParamList, 'Home'>;

type FeedTab = 'active' | 'funded';

export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<FeedTab>('active');
  // Keyed by tab, so the two feeds cache separately and switching back to one you have
  // already seen shows it at once instead of emptying the grid to fetch it again.
  const {
    data: fetched,
    loading,
    refreshing,
    refresh,
  } = useCachedQuery<Project[]>(`projects:${tab}`, useCallback(() => fetchProjects(tab), [tab]));
  const projects = fetched ?? [];
  const { isCompact } = useBreakpoint();
  // Three abreast is where a card still shows its cover, its figure and its three stats
  // without any of them shrinking; a fourth column starts truncating titles.
  const { columns, data, isGrid } = useGrid(projects, { medium: 2, wide: 3 });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header and control sit outside the list, so they need the same width cap as the
          grid below or they end up hanging off its left edge in a wide window. */}
      <PageContainer maxWidth={maxWidth.page}>
        <TourTarget id="home.header" style={styles.headerRow}>
          <Text style={styles.header}>{t('home.title')}</Text>
          <View style={styles.headerActions}>
            <NotificationBell onPress={() => navigation.navigate('Notifications')} />
            <HelpButton topic="home" tour="investor" />
          </View>
        </TourTarget>

        <TourTarget id="home.tabs" style={styles.tabsWrap}>
          <SegmentedTabs
            active={tab}
            onChange={setTab}
            variant="track"
            tabs={[
              { key: 'active', label: t('home.tabRaising') },
              { key: 'funded', label: t('home.tabStarted') },
            ]}
          />
        </TourTarget>
      </PageContainer>

      <FlatList
        // React Native refuses to change `numColumns` on a mounted list, so the count keys
        // the element and a change in it builds a new one.
        key={columns}
        numColumns={columns}
        columnWrapperStyle={isGrid ? styles.row : undefined}
        data={data}
        keyExtractor={(item, index) => item?.id ?? `filler-${index}`}
        contentContainerStyle={[styles.list, !isCompact && styles.listWide]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.textMuted} />
        }
        renderItem={({ item, index }) => {
          if (!item) return isGrid ? <View style={styles.cell} /> : null;
          const card = (
            <ProjectCard
              project={item}
              onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id })}
              onResalePress={() => navigation.navigate('ProjectDetail', { projectId: item.id, scrollToResale: true })}
              onWorksPress={() => navigation.navigate('ProjectWorks', { projectId: item.id })}
            />
          );
          // The tour points at whichever card is first, since that is the one it can be sure
          // is on screen. Wrapping only that one keeps the rest of the feed untouched.
          const body = index === 0 ? <TourTarget id="home.card">{card}</TourTarget> : card;
          // The single-column list renders the card bare, exactly as it always has — the
          // cell wrapper only exists to divide a row between siblings.
          return isGrid ? <View style={styles.cell}>{body}</View> : body;
        }}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>{tab === 'active' ? t('home.emptyRaising') : t('home.emptyStarted')}</Text>
          ) : null
        }
      />
      {loading && projects.length === 0 && <ActivityIndicator style={styles.loader} color={colors.primary} />}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    // The title shares its line with the help button, which is why the padding moved out
    // of the text and onto the row that now holds both.
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm + 4,
    },
    // The bell and the `?` sit together at the right end of the title row; the
    // gap is wide enough that the bell's badge never touches the `?`.
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    header: {
      ...typography.display,
      color: c.text,
      flexShrink: 1,
    },
    // Fixed above the feed, so it carries the rule that separates it from the scrolling list.
    // No rule under the control: the track's own groove already fences it off from the
    // list, and a line on top of that reads as a second, competing edge.
    tabsWrap: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    list: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
    },
    listWide: {
      maxWidth: maxWidth.page,
      width: '100%',
      alignSelf: 'center',
    },
    row: {
      gap: spacing.md,
    },
    // The card already carries its own bottom margin, so the cell only has to claim an
    // equal share of the row.
    cell: {
      flex: 1,
    },
    empty: {
      ...typography.caption,
      textAlign: 'center',
      color: c.textMuted,
      marginTop: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    loader: {
      position: 'absolute',
      top: '50%',
      left: 0,
      right: 0,
    },
  });
