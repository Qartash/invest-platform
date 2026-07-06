import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProjectCard } from '../../components/ProjectCard';
import { fetchProjects } from '../../api/projects';
import { Project } from '../../types';
import { colors, spacing } from '../../theme';
import { InvestorHomeStackParamList } from '../../navigation/InvestorNavigator';

type Props = NativeStackScreenProps<InvestorHomeStackParamList, 'Home'>;

type FeedTab = 'active' | 'funded';

export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
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
    <View style={styles.container}>
      <Text style={styles.header}>{t('home.title')}</Text>

      <View style={styles.tabRow}>
        <Pressable style={[styles.tab, tab === 'active' && styles.tabActive]} onPress={() => setTab('active')}>
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>{t('home.tabRaising')}</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'funded' && styles.tabActive]} onPress={() => setTab('funded')}>
          <Text style={[styles.tabText, tab === 'funded' && styles.tabTextActive]}>{t('home.tabStarted')}</Text>
        </Pressable>
      </View>

      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(tab)} />}
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id })}
            onResalePress={() => navigation.navigate('ProjectDetail', { projectId: item.id, scrollToResale: true })}
          />
        )}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>—</Text> : null}
      />
      {loading && projects.length === 0 && <ActivityIndicator style={styles.loader} color={colors.primary} />}
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
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.xl,
  },
  loader: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
  },
});
