import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { maxWidth, radius, spacing, tabularNums, ThemeColors, typography, useTheme, useThemeStyles } from '../../theme';
import { Card, PageContainer, StatStrip } from '../../components/ui';
import { fetchReferralSummary, fetchReferralTree, ReferralSummary, ReferralTreeNode } from '../../api/referrals';
import { LoadFailed } from '../../components/LoadFailed';

// One node and its subtree. Recursion is bounded by the depth the API returns.
function TreeNode({
  node,
  styles,
  colors,
  t,
}: {
  node: ReferralTreeNode;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  const dotColor = node.qualified ? colors.success : colors.border;
  return (
    <View>
      <View style={styles.nodeRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>{node.avatarEmoji ?? '🙂'}</Text>
        </View>
        <View style={styles.nodeMain}>
          <Text style={[styles.nodeName, node.masked && styles.nodeNameMasked]} numberOfLines={1}>
            {node.name}
          </Text>
          <Text style={styles.nodeSub} numberOfLines={1}>
            {t('referrals.nodeLevel', { level: node.depth })}
            {node.directCount > 0 ? ` · ${t('referrals.nodeInvited', { count: node.directCount })}` : ''}
          </Text>
        </View>
        {node.earned > 0 ? (
          <Text style={styles.nodeEarned}>+{node.earned.toLocaleString()} ֏</Text>
        ) : (
          <View style={[styles.nodeDot, { backgroundColor: dotColor }]} />
        )}
      </View>
      {node.children.length > 0 && (
        <View style={styles.children}>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} styles={styles} colors={colors} t={t} />
          ))}
        </View>
      )}
    </View>
  );
}

export function ReferralTreeScreen() {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [tree, setTree] = useState<ReferralTreeNode[]>([]);
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // "You have invited nobody yet" is a discouraging thing to tell someone whose
  // tree simply failed to arrive.
  const load = useCallback(() => {
    setLoadFailed(false);
    fetchReferralTree(4)
      .then(setTree)
      .catch(() => setLoadFailed(true));
    fetchReferralSummary()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  useFocusEffect(load);

  if (loadFailed) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <PageContainer maxWidth={maxWidth.column}>
          <LoadFailed onRetry={load} />
        </PageContainer>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageContainer maxWidth={maxWidth.column}>
        <StatStrip
          stats={[
            { label: t('referrals.inTree'), value: String(summary?.branchTotal ?? 0) },
            { label: t('referrals.depth'), value: String(summary?.maxDepth ?? 0) },
            { label: t('referrals.earned'), value: `${(summary?.earnedTotal ?? 0).toLocaleString()} ֏`, tone: colors.success },
          ]}
        />

        {tree.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('referrals.treeEmptyTitle')}</Text>
            <Text style={styles.emptyText}>{t('referrals.treeEmptyText')}</Text>
          </Card>
        ) : (
          <Card style={styles.treeCard}>
            {tree.map((node) => (
              <TreeNode key={node.id} node={node} styles={styles} colors={colors} t={t} />
            ))}
          </Card>
        )}

        <Text style={styles.note}>{t('referrals.treePrivacyNote')}</Text>
      </PageContainer>
    </ScrollView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing.md, paddingBottom: spacing.xl },

    treeCard: { marginTop: spacing.md },
    nodeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs + 2 },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: radius.pill,
      backgroundColor: c.surfaceSunken,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarEmoji: { fontSize: 16 },
    nodeMain: { flex: 1, minWidth: 0 },
    nodeName: { ...typography.labelStrong, color: c.text },
    nodeNameMasked: { color: c.textMuted },
    nodeSub: { ...typography.micro, color: c.textMuted, marginTop: 1 },
    nodeEarned: { ...typography.captionStrong, ...tabularNums, color: c.success },
    nodeDot: { width: 8, height: 8, borderRadius: 4 },
    // The branch: a rule down the left, with each child indented off it.
    children: { marginLeft: 17, paddingLeft: spacing.md, borderLeftWidth: 1, borderLeftColor: c.border },

    empty: { marginTop: spacing.md, alignItems: 'center', paddingVertical: spacing.xl },
    emptyTitle: { ...typography.heading, color: c.text },
    emptyText: { ...typography.caption, color: c.textMuted, textAlign: 'center', marginTop: spacing.sm },

    note: {
      ...typography.micro,
      color: c.textMuted,
      lineHeight: 18,
      marginTop: spacing.lg,
      padding: spacing.md,
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
    },
  });
