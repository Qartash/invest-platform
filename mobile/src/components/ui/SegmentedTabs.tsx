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
  /** Shown as a badge after the label. Omit or pass 0 to leave the segment label-only. */
  count?: number;
}

/**
 * `plain` sits on whatever ground the caller provides — the right choice inside a card,
 * where a track would read as a second card. `track` is the screen-level switcher: a sunken
 * groove with the selected segment lifted out of it on `surface`. The lift, not a colour
 * fill, is what marks selection there, so the bottom dock stays the only saturated thing
 * on screen.
 */
export type SegmentedVariant = 'plain' | 'track';

interface Props<T extends string> {
  tabs: TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
  variant?: SegmentedVariant;
}

export function SegmentedTabs<T extends string>({ tabs, active, onChange, variant = 'plain' }: Props<T>) {
  const styles = useThemeStyles(createStyles);
  const track = variant === 'track';
  return (
    <View style={[styles.bar, track && styles.barTrack]}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => {
              logEvent('click', tab.label, { component: 'SegmentedTabs', tab: tab.key });
              onChange(tab.key);
            }}
            style={[
              styles.tab,
              track && styles.tabTrack,
              selected && (track ? styles.tabTrackSelected : styles.tabSelected),
            ]}
          >
            <Text
              style={[
                styles.label,
                track && !selected && styles.labelTrack,
                selected && styles.labelSelected,
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
            {tab.count ? (
              <View style={[styles.badge, selected && styles.badgeSelected]}>
                <Text style={[styles.badgeText, selected && styles.badgeTextSelected]}>{tab.count}</Text>
              </View>
            ) : null}
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
    barTrack: {
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.pill,
      padding: 3,
      gap: 2,
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
    tabTrack: {
      paddingVertical: 6,
      borderRadius: radius.pill,
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
    // Much shallower than `shadow()` — this chip is 30pt tall and sits 3pt proud of its
    // groove, so the app-wide card shadow would read as a smudge under it.
    tabTrackSelected: {
      backgroundColor: c.surface,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    label: {
      ...typography.captionStrong,
      color: c.textMuted,
      // Truncate the label rather than pushing the state dot out of the segment.
      flexShrink: 1,
    },
    // Unselected segments in a track recede — the groove already groups them, so they don't
    // need the weight that a standalone control's labels do.
    labelTrack: {
      ...typography.caption,
    },
    labelSelected: {
      color: c.primary,
    },
    badge: {
      paddingHorizontal: 5,
      borderRadius: radius.pill,
      backgroundColor: c.border,
    },
    badgeSelected: {
      backgroundColor: c.primarySoft,
    },
    badgeText: {
      ...typography.microStrong,
      color: c.textMuted,
    },
    badgeTextSelected: {
      color: c.primary,
    },
  });
