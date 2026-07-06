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
      <Text style={styles.title}>{getLocalizedText(project.title, i18n.language)}</Text>
      {project.founderName && (
        <Text style={styles.founder}>
          {t('project.by')} {project.founderName}
        </Text>
      )}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.row}>
        <Text style={styles.meta}>
          {t('home.raised')}: {collected.toLocaleString()} {t('common.currency')}
        </Text>
        <Text style={styles.meta}>
          {t('home.goal')}: {target.toLocaleString()} {t('common.currency')}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.meta}>
          {t('project.ticketsLeft')}: {ticketsLeft} / {project.totalTickets}
        </Text>
        <Text style={styles.meta}>
          {t('project.investors')}: {project.investorCount ?? 0}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.meta}>
          {t('home.started')}: {formatDate(project.createdAt, i18n.language)}
        </Text>
        {project.deadline && (
          <Text style={styles.meta}>
            {t('home.deadline')}: {formatDate(project.deadline, i18n.language)}
            {typeof project.daysLeft === 'number' ? ` (${project.daysLeft} ${t('home.daysLeft')})` : ''}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    marginBottom: spacing.sm,
    backgroundColor: colors.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  founder: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  meta: {
    fontSize: 13,
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
