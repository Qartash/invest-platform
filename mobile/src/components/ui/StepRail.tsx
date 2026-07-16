import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { spacing, ThemeColors, useThemeStyles } from '../../theme';
import { logEvent } from '../../utils/logger';

/**
 * Per-step completeness, mirroring SegmentedTabs' TabDot vocabulary: 'error' is only
 * ever passed once the user has actually tried to submit — an untouched step is 'todo',
 * not a mistake they haven't had the chance to make yet.
 */
export type StepState = 'done' | 'todo' | 'error';

interface Props {
  states: StepState[];
  /** Index of the step currently on screen; painted primary regardless of its own state. */
  active: number;
  onSelect: (index: number) => void;
  /** Accessibility labels, one per step — the rail itself carries no visible text. */
  labels: string[];
}

/**
 * A step's worth of progress in 3px. Doubles as navigation: any step can be reached
 * from any other, which is what makes the review checklist's "jump to the problem"
 * rows possible.
 */
export function StepRail({ states, active, onSelect, labels }: Props) {
  const styles = useThemeStyles(createStyles);
  return (
    <View style={styles.rail}>
      {states.map((state, index) => (
        <Pressable
          key={index}
          // The bar is 3px tall; the touch target has to be a finger, not a hairline.
          hitSlop={{ top: 14, bottom: 14, left: 2, right: 2 }}
          accessibilityRole="tab"
          accessibilityLabel={labels[index]}
          accessibilityState={{ selected: index === active }}
          onPress={() => {
            logEvent('click', labels[index], { component: 'StepRail', step: index });
            onSelect(index);
          }}
          style={styles.segmentWrap}
        >
          <View style={[styles.segment, index === active ? styles.current : styles[state]]} />
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    rail: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    segmentWrap: {
      flex: 1,
    },
    segment: {
      height: 3,
      borderRadius: 2,
    },
    current: {
      backgroundColor: c.primary,
    },
    done: {
      backgroundColor: c.success,
    },
    todo: {
      backgroundColor: c.border,
    },
    error: {
      backgroundColor: c.danger,
    },
  });
