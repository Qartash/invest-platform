import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Project } from '../types';
import { getLocalizedText } from '../utils/localized';
import { formatDate } from '../utils/date';
import { resolveMediaUrl } from '../api/client';
import { radius, spacing, tabularNums, ThemeColors, typography, useThemeStyles } from '../theme';
import { HeroScrim, Pill } from './ui';

interface Props {
  project: Project;
  onPress: () => void;
  onResalePress?: () => void;
}

// Mirrors the project screen's hero — cover, scrim, title over the image — so opening a card
// reads as the same surface expanding rather than a jump to a differently-built page.
export function ProjectCard({ project, onPress, onResalePress }: Props) {
  const { t, i18n } = useTranslation();
  const styles = useThemeStyles(createStyles);
  const collected = parseFloat(project.collectedAmount);
  const target = parseFloat(project.targetAmount);
  const progress = target > 0 ? Math.min(collected / target, 1) : 0;
  const ticketsLeft = project.totalTickets - project.ticketsSold;
  const hasResale = project.resaleEnabled && (project.resaleTicketsCount ?? 0) > 0;
  const showsDeadline = project.deadline && typeof project.daysLeft === 'number';

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.cover}>
        {project.coverImageUrl ? (
          <Image source={{ uri: resolveMediaUrl(project.coverImageUrl) }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.coverFallback]} />
        )}
        <HeroScrim />
        {hasResale && (
          <Pressable
            hitSlop={8}
            onPress={onResalePress}
            disabled={!onResalePress}
            style={({ pressed }) => [styles.resaleChip, pressed && onResalePress && styles.pressed]}
          >
            <Text style={styles.resaleChipText}>
              🔁 {t('project.resaleBadge', { count: project.resaleTicketsCount })}
            </Text>
          </Pressable>
        )}
        <View style={styles.coverBody}>
          <Text style={styles.title} numberOfLines={2}>
            {getLocalizedText(project.title, i18n.language)}
          </Text>
          {project.founderName && (
            <Text style={styles.founder} numberOfLines={1}>
              {t('project.by')} {project.founderName}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.fundingRow}>
          <Text style={styles.fundingValue}>{collected.toLocaleString()}</Text>
          <Text style={styles.fundingCurrency}>{t('common.currency')}</Text>
          <View style={styles.spacer} />
          <Pill label={t('home.percentFunded', { percent: Math.round(progress * 100) })} tone="success" />
        </View>
        <Text style={styles.fundingGoal}>
          {t('home.ofGoal', { amount: target.toLocaleString(), currency: t('common.currency') })}
        </Text>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>{t('home.statTickets')}</Text>
            <Text style={styles.statValue}>
              {ticketsLeft}/{project.totalTickets}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>{t('home.statInvestors')}</Text>
            <Text style={styles.statValue}>{project.investorCount ?? 0}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>{showsDeadline ? t('home.statDeadline') : t('home.statStarted')}</Text>
            <Text style={styles.statValue}>
              {showsDeadline
                ? t('home.daysShort', { days: project.daysLeft })
                : formatDate(project.createdAt, i18n.language)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    pressed: {
      opacity: 0.75,
    },
    cover: {
      height: 150,
      justifyContent: 'flex-end',
      backgroundColor: c.primaryDark,
    },
    coverFallback: {
      backgroundColor: c.primaryDark,
    },
    resaleChip: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      backgroundColor: c.onOverlayFill,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    resaleChipText: {
      ...typography.microStrong,
      color: c.onOverlay,
    },
    coverBody: {
      padding: spacing.md - 4,
    },
    title: {
      ...typography.heading,
      color: c.onOverlay,
    },
    founder: {
      ...typography.micro,
      color: c.onOverlayMuted,
      marginTop: 2,
    },

    body: {
      padding: spacing.md - 4,
    },
    fundingRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 3,
    },
    spacer: {
      flex: 1,
    },
    fundingValue: {
      ...typography.title,
      ...tabularNums,
      color: c.text,
    },
    fundingCurrency: {
      ...typography.captionStrong,
      color: c.textMuted,
    },
    fundingGoal: {
      ...typography.micro,
      color: c.textMuted,
      marginTop: 2,
      marginBottom: spacing.sm + 2,
    },
    track: {
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: c.surfaceSunken,
      overflow: 'hidden',
      marginBottom: spacing.sm + 4,
    },
    fill: {
      height: '100%',
      borderRadius: radius.pill,
      backgroundColor: c.success,
    },
    statRow: {
      flexDirection: 'row',
      gap: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: spacing.sm + 2,
    },
    stat: {
      flex: 1,
    },
    statLabel: {
      ...typography.eyebrow,
      color: c.textMuted,
    },
    statValue: {
      ...typography.captionStrong,
      ...tabularNums,
      color: c.text,
      marginTop: 2,
    },
  });
