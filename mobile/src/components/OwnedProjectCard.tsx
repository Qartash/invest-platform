import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Project } from '../types';
import { getLocalizedText } from '../utils/localized';
import { resolveMediaUrl } from '../api/client';
import {
  DIFF_FIELD_LABEL_KEYS,
  LOCALIZED_DIFF_FIELDS,
  formatDiffValue,
  formatLocalizedDiffText,
  getChangedLanguages,
} from '../utils/projectDiff';
import { LANGUAGE_LABELS } from '../i18n';
import { radius, spacing, tabularNums, ThemeColors, typography, useTheme, useThemeStyles } from '../theme';
import { ActionSheet, ActionSheetItem, DisclosureRow, HeroScrim, Icon, IconName, StatStrip } from './ui';
import { RichTextView } from './RichTextView';

const RESTORE_WINDOW_DAYS = 7;
const VISIBLE_DIFF_ROWS = 2;

interface Props {
  project: Project;
  busy: boolean;
  onOpenFinance: () => void;
  onOpenWorks: () => void;
  onOpenHistory: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPreview: () => void;
  onCancelReview: () => void;
  onCancelDeletion: () => void;
  onRestore: () => void;
}

// The founder's view of their own project. Mirrors ProjectCard — same hero, same funding
// block, same stat band — so switching between "Проекты" and "Мои проекты" doesn't feel like
// switching apps. What differs is everything below the band: navigation, moderation state,
// and the overflow menu that keeps editing and deletion off the card face.
export function OwnedProjectCard(props: Props) {
  const { project, busy } = props;
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [allDiffs, setAllDiffs] = useState(false);

  const collected = parseFloat(project.collectedAmount);
  const target = parseFloat(project.targetAmount);
  const progress = target > 0 ? Math.min(collected / target, 1) : 0;
  const showsDeadline = project.deadline && typeof project.daysLeft === 'number';
  const rejected = project.status === 'rejected';

  const daysLeftToRestore = project.deletedAt
    ? RESTORE_WINDOW_DAYS -
      Math.floor((Date.now() - new Date(project.deletedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const menuItems: ActionSheetItem[] = [
    { key: 'edit', label: t('founder.editProject'), icon: 'edit', onPress: props.onEdit },
    { key: 'history', label: t('founder.historyTitle'), icon: 'history', onPress: props.onOpenHistory },
    { key: 'preview', label: t('founder.previewProject'), icon: 'eye', onPress: props.onPreview },
    {
      key: 'delete',
      label: t('founder.deleteProject'),
      icon: 'trash',
      destructive: true,
      disabled: busy,
      onPress: props.onDelete,
    },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.cover}>
        {project.coverImageUrl ? (
          <Image source={{ uri: resolveMediaUrl(project.coverImageUrl) }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.coverFallback]} />
        )}
        <HeroScrim />
        <View style={[styles.chip, styles.chipLeft]}>
          <Text style={[styles.chipText, rejected && styles.chipTextRejected]}>
            {t(`project.status.${project.status}`)}
          </Text>
        </View>
        <Pressable
          hitSlop={10}
          onPress={() => setMenuOpen(true)}
          style={({ pressed }) => [styles.chip, styles.chipRight, styles.chipButton, pressed && styles.pressed]}
        >
          <Icon name="dots" size={16} color={colors.onOverlay} />
        </Pressable>
        <View style={styles.coverBody}>
          <Text style={styles.title} numberOfLines={2}>
            {getLocalizedText(project.title, i18n.language)}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.fundingRow}>
          <Text style={styles.percent}>{Math.round(progress * 100)}%</Text>
          <Text style={styles.fundingMeta} numberOfLines={1}>
            {collected.toLocaleString()}{' '}
            {t('home.ofGoal', { amount: target.toLocaleString(), currency: t('common.currency') })}
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>

        <StatStrip
          bounded
          stats={[
            { label: t('home.statInvestors'), value: String(project.investorCount ?? 0) },
            {
              label: t('home.statTickets'),
              value: `${project.ticketsSold}/${project.totalTickets}`,
            },
            {
              label: showsDeadline ? t('home.statDeadline') : t('founder.statEquity'),
              value: showsDeadline
                ? t('home.daysShort', { days: project.daysLeft })
                : `${parseFloat(project.equityOfferedPercent)}%`,
            },
          ]}
        />

        {/* Two destinations, not three: the change log is read once in a blue moon and lives
            in the overflow menu, where it doesn't take a third of the card's action row. */}
        <View style={styles.navRow}>
          <NavButton icon="chart" label={t('founder.navFinance')} onPress={props.onOpenFinance} />
          <NavButton icon="checklist" label={t('founder.navWorks')} onPress={props.onOpenWorks} />
        </View>

        {renderState()}

        {!!project.reviewComment && (
          <DisclosureRow
            icon="comment"
            label={t('founder.reviewCommentLabel')}
            tone={rejected ? 'danger' : 'muted'}
            expanded={commentOpen || rejected}
            onToggle={() => setCommentOpen((v) => !v)}
          >
            <RichTextView
              html={project.reviewComment}
              textStyle={styles.comment}
              color={colors.textMuted}
              fontSize={13}
            />
          </DisclosureRow>
        )}
      </View>

      <ActionSheet
        visible={menuOpen}
        title={getLocalizedText(project.title, i18n.language)}
        items={menuItems}
        onClose={() => setMenuOpen(false)}
      />
    </View>
  );

  function renderState() {
    if (project.deletedAt) {
      return daysLeftToRestore > 0 ? (
        <View style={styles.stateBlock}>
          <Text style={styles.stateNoticeDanger}>
            {t('founder.deletedRestorableNotice', { days: daysLeftToRestore })}
          </Text>
          <StateButton label={t('founder.restoreProject')} onPress={props.onRestore} disabled={busy} />
        </View>
      ) : (
        <View style={styles.stateBlock}>
          <Text style={styles.stateNoticeDanger}>{t('founder.deletedFinalNotice')}</Text>
        </View>
      );
    }

    if (project.deletionRequestedAt) {
      return (
        <View style={styles.stateBlock}>
          <Text style={styles.stateNotice}>{t('founder.deletionPendingNotice')}</Text>
          <StateButton
            label={t('founder.cancelDeletionRequest')}
            onPress={props.onCancelDeletion}
            disabled={busy}
          />
        </View>
      );
    }

    // Two ways to be waiting on a moderator: sitting in pending_review before ever
    // going live, or live and carrying a proposed edit. The second no longer shows
    // up as a status, so the notice and the withdraw button hang off pendingChanges.
    if (project.status !== 'pending_review' && !project.pendingChanges) return null;

    return (
      <View style={styles.stateBlock}>
        <Text style={styles.stateNotice}>
          {project.pendingChanges ? t('founder.editPendingNotice') : t('founder.reviewPendingNotice')}
        </Text>
        {project.pendingChanges && renderDiffs(project.pendingChanges)}
        <StateButton label={t('founder.cancelReview')} onPress={props.onCancelReview} disabled={busy} />
      </View>
    );
  }

  // The full diff used to unroll inside the card — a dozen rows of struck-through text above
  // the actions. Only the first couple carry the "what changed" signal; the rest is on demand.
  function renderDiffs(pendingChanges: Record<string, any>) {
    const rows = Object.entries(pendingChanges)
      .map(([field, newValue]) => {
        if (LOCALIZED_DIFF_FIELDS.includes(field)) {
          const oldValue = (project as any)[field];
          const changedLangs = getChangedLanguages(oldValue, newValue);
          if (changedLangs.length === 0) return null;
          return (
            <View key={field} style={styles.diffRow}>
              <Text style={styles.diffLabel}>
                {t(DIFF_FIELD_LABEL_KEYS[field] ?? field)}{'  '}
                <Text style={styles.diffLangSummary}>
                  ({changedLangs.map((lang) => LANGUAGE_LABELS[lang]).join(', ')})
                </Text>
              </Text>
              {changedLangs.map((lang) => (
                <View key={lang} style={styles.diffValues}>
                  <Text style={styles.diffLangTag}>{lang.toUpperCase()}</Text>
                  <Text style={styles.diffOld} numberOfLines={2}>
                    {formatLocalizedDiffText(field, oldValue?.[lang])}
                  </Text>
                  <Text style={styles.diffArrow}>→</Text>
                  <Text style={styles.diffNew} numberOfLines={2}>
                    {formatLocalizedDiffText(field, newValue?.[lang])}
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <View key={field} style={styles.diffRow}>
            <Text style={styles.diffLabel}>{t(DIFF_FIELD_LABEL_KEYS[field] ?? field)}</Text>
            <View style={styles.diffValues}>
              <Text style={styles.diffOld} numberOfLines={2}>
                {formatDiffValue(field, (project as any)[field], t, i18n.language)}
              </Text>
              <Text style={styles.diffArrow}>→</Text>
              <Text style={styles.diffNew} numberOfLines={2}>
                {formatDiffValue(field, newValue, t, i18n.language)}
              </Text>
            </View>
          </View>
        );
      })
      .filter(Boolean);

    const hidden = rows.length - VISIBLE_DIFF_ROWS;

    return (
      <View style={styles.diffBox}>
        {!!project.pendingChangeReason && (
          <View style={styles.founderNote}>
            <Text style={styles.founderNoteLabel}>{t('founder.pendingChangeReasonLabel')}</Text>
            <Text style={styles.founderNoteText}>{project.pendingChangeReason}</Text>
          </View>
        )}
        {(allDiffs ? rows : rows.slice(0, VISIBLE_DIFF_ROWS))}
        {hidden > 0 && (
          <Pressable onPress={() => setAllDiffs((v) => !v)} hitSlop={6}>
            <Text style={styles.diffMore}>
              {allDiffs ? t('founder.diffCollapse') : t('founder.diffExpand', { count: hidden })}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }
}

function NavButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}>
      <Icon name={icon} size={16} color={colors.text} />
      <Text style={styles.navLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function StateButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const styles = useThemeStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.stateButton, (pressed || disabled) && styles.pressed]}
    >
      <Text style={styles.stateButtonLabel}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
      marginBottom: spacing.md,
    },
    pressed: {
      opacity: 0.7,
    },
    cover: {
      height: 140,
      justifyContent: 'flex-end',
      backgroundColor: c.primaryDark,
    },
    coverFallback: {
      backgroundColor: c.primaryDark,
    },
    chip: {
      position: 'absolute',
      top: spacing.sm,
      backgroundColor: c.overlayStrong,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    chipLeft: {
      left: spacing.sm,
    },
    chipRight: {
      right: spacing.sm,
    },
    chipButton: {
      width: 28,
      height: 28,
      paddingHorizontal: 0,
      paddingVertical: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipText: {
      ...typography.microStrong,
      color: c.success,
    },
    chipTextRejected: {
      color: c.danger,
    },
    coverBody: {
      padding: spacing.md - 4,
    },
    title: {
      ...typography.subheading,
      color: c.onOverlay,
    },

    body: {
      padding: spacing.md - 4,
    },
    fundingRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.xs + 2,
      marginBottom: spacing.sm,
    },
    percent: {
      ...typography.title,
      ...tabularNums,
      color: c.text,
    },
    fundingMeta: {
      ...typography.micro,
      color: c.textMuted,
      flex: 1,
    },
    track: {
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: c.surfaceSunken,
      overflow: 'hidden',
      marginBottom: spacing.md - 4,
    },
    fill: {
      height: '100%',
      borderRadius: radius.pill,
      backgroundColor: c.success,
    },

    navRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md - 4,
    },
    navButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs + 2,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.border,
    },
    navLabel: {
      ...typography.captionStrong,
      color: c.text,
      flexShrink: 1,
    },

    stateBlock: {
      marginTop: spacing.md - 4,
    },
    stateNotice: {
      ...typography.micro,
      color: c.textMuted,
      fontStyle: 'italic',
    },
    stateNoticeDanger: {
      ...typography.micro,
      color: c.danger,
      fontStyle: 'italic',
    },
    stateButton: {
      alignSelf: 'flex-start',
      marginTop: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md - 4,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.border,
    },
    stateButtonLabel: {
      ...typography.captionStrong,
      color: c.text,
    },

    diffBox: {
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.md,
      padding: spacing.sm + 2,
      marginTop: spacing.sm,
    },
    founderNote: {
      backgroundColor: c.surface,
      borderRadius: radius.sm,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    founderNoteLabel: {
      ...typography.eyebrow,
      color: c.textMuted,
      marginBottom: 2,
    },
    founderNoteText: {
      ...typography.micro,
      color: c.text,
      fontStyle: 'italic',
    },
    diffRow: {
      marginBottom: spacing.xs + 2,
    },
    diffLabel: {
      ...typography.micro,
      color: c.textMuted,
    },
    diffLangSummary: {
      ...typography.microStrong,
      color: c.primary,
    },
    diffValues: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
      gap: spacing.xs,
    },
    diffLangTag: {
      ...typography.microStrong,
      fontSize: 10,
      color: c.textMuted,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 4,
      paddingHorizontal: 4,
      overflow: 'hidden',
    },
    diffOld: {
      ...typography.micro,
      flex: 1,
      color: c.danger,
      textDecorationLine: 'line-through',
    },
    diffArrow: {
      ...typography.micro,
      color: c.textMuted,
    },
    diffNew: {
      ...typography.microStrong,
      flex: 1,
      color: c.success,
    },
    diffMore: {
      ...typography.microStrong,
      color: c.primary,
      marginTop: 2,
    },

    comment: {
      ...typography.caption,
      color: c.textMuted,
    },
  });
