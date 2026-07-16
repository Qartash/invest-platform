import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, ThemeColors, typography, useThemeStyles } from '../../theme';
import { logEvent } from '../../utils/logger';

/** Completeness marker for tabs that each own a chunk of work — e.g. one per content language. */
export type TabDot = 'done' | 'todo' | 'missing';

export interface TabItem<T extends string> {
  key: T;
  label: string;
  dot?: TabDot;
}

interface Props<T extends string> {
  tabs: TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
}

export function SegmentedTabs<T extends string>({ tabs, active, onChange }: Props<T>) {
  const styles = useThemeStyles(createStyles);
  return (
    <View style={styles.bar}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => {
              logEvent('click', tab.label, { component: 'SegmentedTabs', tab: tab.key });
              onChange(tab.key);
            }}
            style={[styles.tab, selected && styles.tabSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
              {tab.label}
            </Text>
            {tab.dot && <View style={[styles.dot, styles[tab.dot]]} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    // Just the control — no ground, no rule, no outer padding. A caller that pins this to
    // the top of a screen owns the opaque background and the divider under it; a caller that
    // drops it into a card owns nothing. Baking that chrome in here put a grey strip and a
    // stray line inside every card the control appeared in.
    bar: {
      flexDirection: 'row',
      gap: spacing.xs + 2,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs + 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.sm + 1,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    done: {
      backgroundColor: c.success,
    },
    // Outstanding, but not yet an error — the screen only turns this red once the user has
    // actually tried to submit.
    todo: {
      backgroundColor: c.border,
    },
    missing: {
      backgroundColor: c.danger,
    },
    tabSelected: {
      backgroundColor: c.primarySoft,
    },
    label: {
      ...typography.captionStrong,
      color: c.textMuted,
      // Truncate the label rather than pushing the state dot out of the segment.
      flexShrink: 1,
    },
    labelSelected: {
      color: c.primary,
    },
  });
