import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { clearLogs, fetchLogs, fetchLogSettings, updateLogSettings } from '../../api/logs';
import { LogSettings, LogSource, SystemLog } from '../../types';
import { formatDateTime } from '../../utils/date';
import { showAlert } from '../../utils/alert';
import { spacing, ThemeColors, useThemeStyles, useTheme } from '../../theme';
import { PrimaryButton } from '../../components/PrimaryButton';

// 'console' isn't a source of its own (console output is filed under the frontend/backend
// source it came from) — it's a category filter, offered alongside the source filters so an
// admin can isolate raw console.log/warn/error output regardless of which side produced it.
type FilterKey = LogSource | 'all' | 'console';
const SOURCE_FILTERS: FilterKey[] = ['all', 'frontend', 'backend', 'error', 'database', 'console'];

// Log source -> colour, built per palette so the badges follow the theme.
const sourceColors = (c: ThemeColors): Record<LogSource, string> => ({
  frontend: c.chartAccent,
  backend: c.primary,
  error: c.danger,
  database: c.warning,
});

export function LogsScreen() {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const SOURCE_COLORS = useMemo(() => sourceColors(colors), [colors]);
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<LogSettings | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 50;
  // Filter/page changes can race in flight (e.g. switching filters fires a new request before
  // the previous one resolves); only the response matching the most recently issued request
  // is allowed to update state, so a slow stale response can't clobber a newer one.
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (targetPage: number, targetFilter: FilterKey) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const isConsoleFilter = targetFilter === 'console';
        const [settingsData, logsData] = await Promise.all([
          fetchLogSettings(),
          fetchLogs({
            source: isConsoleFilter || targetFilter === 'all' ? undefined : targetFilter,
            category: isConsoleFilter ? 'console' : undefined,
            page: targetPage,
            pageSize: PAGE_SIZE,
          }),
        ]);
        if (requestId !== requestIdRef.current) return;
        setSettings(settingsData);
        if (targetPage === 1) {
          setLogs(logsData.items);
        } else {
          setLogs((prev) => prev.concat(logsData.items));
        }
        setTotal(logsData.total);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      setPage(1);
      load(1, filter);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]),
  );

  const handleToggle = async (key: keyof LogSettings, value: boolean) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    await updateLogSettings({ [key]: value });
  };

  const handleClear = () => {
    showAlert(t('moderation.logs.clearConfirmTitle'), t('moderation.logs.clearConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('moderation.logs.clear'),
        style: 'destructive',
        onPress: async () => {
          await clearLogs();
          setPage(1);
          load(1, filter);
        },
      },
    ]);
  };

  const loadMore = () => {
    if (logs.length >= total || loading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    load(nextPage, filter);
  };

  return (
    <View style={styles.container}>
      {settings && (
        <View style={styles.settingsCard}>
          <ToggleRow
            label={t('moderation.logs.frontendClicks')}
            value={settings.frontendClicksEnabled}
            onChange={(v) => handleToggle('frontendClicksEnabled', v)}
          />
          <ToggleRow
            label={t('moderation.logs.backendRequests')}
            value={settings.backendRequestsEnabled}
            onChange={(v) => handleToggle('backendRequestsEnabled', v)}
          />
          <ToggleRow
            label={t('moderation.logs.errors')}
            value={settings.errorsEnabled}
            onChange={(v) => handleToggle('errorsEnabled', v)}
          />
          <ToggleRow
            label={t('moderation.logs.databaseQueries')}
            value={settings.databaseQueriesEnabled}
            onChange={(v) => handleToggle('databaseQueriesEnabled', v)}
          />
          <ToggleRow
            label={t('moderation.logs.consoleLogs')}
            value={settings.consoleLogsEnabled}
            onChange={(v) => handleToggle('consoleLogsEnabled', v)}
          />
        </View>
      )}

      <View style={styles.filterRow}>
        {SOURCE_FILTERS.map((source) => (
          <Pressable
            key={source}
            style={[styles.filterChip, filter === source && styles.filterChipActive]}
            onPress={() => setFilter(source)}
          >
            <Text style={[styles.filterChipText, filter === source && styles.filterChipTextActive]}>
              {t(`moderation.logs.source.${source}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => {
          const isExpanded = expandedId === item.id;
          return (
            <Pressable style={styles.logRow} onPress={() => setExpandedId(isExpanded ? null : item.id)}>
              <View style={styles.logHeaderRow}>
                <View style={[styles.sourceBadge, { borderColor: SOURCE_COLORS[item.source] }]}>
                  <Text style={[styles.sourceBadgeText, { color: SOURCE_COLORS[item.source] }]}>{item.source}</Text>
                </View>
                <Text style={styles.logTime}>{formatDateTime(item.createdAt, i18n.language)}</Text>
              </View>
              <Text style={styles.logMessage}>{item.message}</Text>
              <Text style={styles.logCategory}>{item.category}</Text>
              {isExpanded && item.metadata && (
                <Text style={styles.logMetadata}>{JSON.stringify(item.metadata, null, 2)}</Text>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>{t('moderation.logs.empty')}</Text> : null}
        ListFooterComponent={
          <View style={styles.footer}>
            <PrimaryButton title={t('moderation.logs.clear')} variant="outline" onPress={handleClear} />
          </View>
        }
      />
    </View>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const styles = useThemeStyles(createStyles);
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    settingsCard: {
      marginHorizontal: spacing.lg,
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    toggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    toggleLabel: {
      color: c.text,
      flex: 1,
      marginRight: spacing.sm,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    filterChip: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      marginRight: spacing.xs,
      marginBottom: spacing.xs,
    },
    filterChipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    filterChipText: {
      fontSize: 12,
      color: c.textMuted,
    },
    filterChipTextActive: {
      color: c.textOnAccent,
      fontWeight: '600',
    },
    list: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
    },
    logRow: {
      backgroundColor: c.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.sm,
      marginBottom: spacing.xs,
    },
    logHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    sourceBadge: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: spacing.xs,
      paddingVertical: 1,
    },
    sourceBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    logTime: {
      fontSize: 11,
      color: c.textMuted,
    },
    logMessage: {
      fontSize: 13,
      color: c.text,
      fontWeight: '600',
    },
    logCategory: {
      fontSize: 11,
      color: c.textMuted,
    },
    logMetadata: {
      fontSize: 10,
      color: c.textMuted,
      marginTop: spacing.xs,
      fontFamily: 'monospace',
    },
    empty: {
      textAlign: 'center',
      color: c.textMuted,
      marginTop: spacing.xl,
    },
    footer: {
      paddingVertical: spacing.md,
    },
  });
