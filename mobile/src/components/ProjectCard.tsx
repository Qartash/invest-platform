import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Project } from '../types';
import { getLocalizedText } from '../utils/localized';
import { formatDate } from '../utils/date';
import { resolveMediaUrl } from '../api/client';
import { colors, spacing } from '../theme';

interface Props {
  project: Project;
  onPress: () => void;
  onResalePress?: () => void;
}

export function ProjectCard({ project, onPress, onResalePress }: Props) {
  const { t, i18n } = useTranslation();
  const collected = parseFloat(project.collectedAmount);
  const target = parseFloat(project.targetAmount);
  const progress = target > 0 ? Math.min(collected / target, 1) : 0;
  const ticketsLeft = project.totalTickets - project.ticketsSold;
  const hasResale = project.resaleEnabled && (project.resaleTicketsCount ?? 0) > 0;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {project.coverImageUrl ? (
        <Image source={{ uri: resolveMediaUrl(project.coverImageUrl) }} style={styles.cover} />
      ) : null}
      {hasResale && (
        <Pressable
          hitSlop={8}
          onPress={onResalePress}
          disabled={!onResalePress}
          style={({ pressed }) => [styles.resaleBadge, pressed && onResalePress && styles.resaleBadgePressed]}
        >
          <Text style={styles.resaleBadgeText}>
            🔁 {t('project.resaleBadge', { count: project.resaleTicketsCount })}
          </Text>
        </Pressable>
      )}

      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={2}>
          {getLocalizedText(project.title, i18n.language)}
        </Text>
        <View style={styles.percentBadge}>
          <Text style={styles.percentBadgeText}>{t('home.percentFunded', { percent: Math.round(progress * 100) })}</Text>
        </View>
      </View>
      {project.founderName && (
        <Text style={styles.founder}>
          {t('project.by')} {project.founderName}
        </Text>
      )}

      <View style={styles.heroRow}>
        <Text style={styles.heroValue}>
          {collected.toLocaleString()} {t('common.currency')}
        </Text>
        <Text style={styles.heroMeta}>{t('home.ofGoal', { amount: target.toLocaleString(), currency: t('common.currency') })}</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={styles.statIcon}>📦</Text>
          <Text style={styles.statText}>
            {ticketsLeft}/{project.totalTickets}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statIcon}>👥</Text>
          <Text style={styles.statText}>{project.investorCount ?? 0}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statIcon}>📅</Text>
          <Text style={styles.statText}>
            {project.deadline && typeof project.daysLeft === 'number'
              ? `${project.daysLeft} ${t('home.daysLeft')}`
              : formatDate(project.createdAt, i18n.language)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginBottom: spacing.sm,
    backgroundColor: colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginRight: spacing.sm,
  },
  percentBadge: {
    backgroundColor: 'rgba(34, 165, 89, 0.12)',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  percentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  founder: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  heroValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginRight: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  heroMeta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  statRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  statIcon: {
    fontSize: 13,
    marginRight: spacing.xs,
  },
  statText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  resaleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginBottom: spacing.xs,
  },
  resaleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  resaleBadgePressed: {
    opacity: 0.6,
  },
});
