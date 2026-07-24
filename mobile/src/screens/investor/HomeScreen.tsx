import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProjectCard } from '../../components/ProjectCard';
import { PageContainer, SegmentedTabs, useGrid } from '../../components/ui';
import { fetchProjects } from '../../api/projects';
import { Project } from '../../types';
import { maxWidth, spacing, ThemeColors, typography, useBreakpoint, useTheme, useThemeStyles } from '../../theme';
import { InvestorHomeStackParamList } from '../../navigation/InvestorNavigator';

type Props = NativeStackScreenProps<InvestorHomeStackParamList, 'Home'>;

type FeedTab = 'active' | 'funded';

export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<FeedTab>('active');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { isCompact } = useBreakpoint();
  // Three abreast is where a card still shows its cover, its figure and its three stats
  // without any of them shrinking; a fourth column starts truncating titles.
  const { columns, data, isGrid } = useGrid(projects, { medium: 2, wide: 3 });

  const load = useCallback(async (status: FeedTab) => {
    setLoading(true);
    try {
      const data = await fetchProjects(status);
      setProjects(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(tab);
    }, [load, tab]),
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header and control sit outside the list, so they need the same width cap as the
          grid below or they end up hanging off its left edge in a wide window. */}
      <PageContainer maxWidth={maxWidth.page}>
        <Text style={styles.header}>{t('home.title')}</Text>

        <View style={styles.tabsWrap}>
          <SegmentedTabs
            active={tab}
            onChange={setTab}
            variant="track"
            tabs={[
              { key: 'active', label: t('home.tabRaising') },
              { key: 'funded', label: t('home.tabStarted') },
            ]}
          />
        </View>
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
          <RefreshControl refreshing={loading} onRefresh={() => load(tab)} tintColor={colors.textMuted} />
        }
        renderItem={({ item }) =>
          // The single-column list renders the card bare, exactly as it always has — the
          // cell wrapper only exists to divide a row between siblings.
          isGrid ? (
            <View style={styles.cell}>
              {item && (
                <ProjectCard
                  project={item}
                  onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id })}
                  onResalePress={() =>
                    navigation.navigate('ProjectDetail', { projectId: item.id, scrollToResale: true })
                  }
                  onWorksPress={() => navigation.navigate('ProjectWorks', { projectId: item.id })}
                />
              )}
            </View>
          ) : item ? (
            <ProjectCard
              project={item}
              onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id })}
              onResalePress={() => navigation.navigate('ProjectDetail', { projectId: item.id, scrollToResale: true })}
              onWorksPress={() => navigation.navigate('ProjectWorks', { projectId: item.id })}
            />
          ) : null
        }
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
    header: {
      ...typography.display,
      color: c.text,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm + 4,
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
