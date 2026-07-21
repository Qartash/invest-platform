import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProjectCard } from '../../components/ProjectCard';
import { SegmentedTabs } from '../../components/ui';
import { fetchProjects } from '../../api/projects';
import { Project } from '../../types';
import { spacing, ThemeColors, typography, useTheme, useThemeStyles } from '../../theme';
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

      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => load(tab)} tintColor={colors.textMuted} />
        }
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id })}
            onResalePress={() => navigation.navigate('ProjectDetail', { projectId: item.id, scrollToResale: true })}
            onWorksPress={() => navigation.navigate('ProjectWorks', { projectId: item.id })}
          />
        )}
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
