import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { radius, spacing, tabularNums, ThemeColors, typography, useThemeStyles } from '../../../theme';

interface Props {
  /** Sum of every budget line, saved and unsaved. */
  allocated: number;
  /** The funding goal from the previous step — the whole point of the comparison. */
  target: number;
}

/**
 * Ties the budget breakdown back to the funding goal. On its own a list of expense lines
 * says nothing; against the goal it says "you have 2 800 000 left to account for", which
 * is the question a moderator will ask anyway.
 */
export function BudgetMeter({ allocated, target }: Props) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();
  const currency = t('common.currency');

  const over = target > 0 && allocated > target;
  const remaining = target - allocated;
  const ratio = target > 0 ? Math.min(1, allocated / target) : 0;

  const note = () => {
    if (target <= 0) return t('founder.wizard.budgetNoGoal');
    if (over) return t('founder.wizard.budgetOver', { amount: (-remaining).toLocaleString(), currency });
    if (remaining === 0) return t('founder.wizard.budgetAllDone');
    return t('founder.wizard.budgetRemaining', { amount: remaining.toLocaleString(), currency });
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.value}>
          {allocated.toLocaleString()} {currency}
        </Text>
        <Text style={styles.of}>{t('founder.wizard.budgetOfGoal', { amount: target.toLocaleString(), currency })}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%` }, over && styles.fillOver]} />
      </View>
      <Text style={[styles.note, over && styles.noteOver]}>{note()}</Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    value: {
      ...typography.title,
      ...tabularNums,
      color: c.text,
    },
    of: {
      ...typography.caption,
      ...tabularNums,
      color: c.textMuted,
    },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.surfaceSunken,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: c.primary,
    },
    // Overshooting the goal isn't fatal — the project still saves — so this warns in place
    // rather than blocking the step.
    fillOver: {
      backgroundColor: c.danger,
    },
    note: {
      ...typography.micro,
      color: c.textMuted,
      marginTop: spacing.xs + 3,
    },
    noteOver: {
      color: c.danger,
    },
  });
