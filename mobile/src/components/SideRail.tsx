import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BrandMark } from './BrandMark';
import { radius, spacing, ThemeColors, typography, useTheme, useThemeStyles } from '../theme';
import { TourTarget } from '../onboarding/TourTarget';
import { pressTab } from '../navigation/tabPress';

/**
 * The same four tabs as {@link BottomDock}, laid down the left edge for a desktop window.
 *
 * A floating dock is a thumb-reach affordance: it exists because the bottom of a phone is
 * the only place a thumb reaches. On a mouse-driven window nothing is out of reach and the
 * bottom of a 900px-tall viewport is the furthest point from where the eye starts, so the
 * navigation moves to the edge desktop users already look at.
 *
 * The dock's captionless icons don't survive the move — four pills in a column read as an
 * unlabelled toolbar rather than as navigation. There is room here for the names, so the
 * labels come back and the icons drop to a normal 24. Selection stays a filled pill, the
 * one piece of the dock's language worth keeping: it is unambiguous, and it means the two
 * bars read as the same app.
 *
 * `BottomTabBarProps` is honoured exactly as the dock honours it, so the navigator cannot
 * tell which of the two it is rendering.
 */
export function SideRail(props: BottomTabBarProps) {
  const { state, descriptors, navigation, insets } = props;
  const styles = useThemeStyles(createStyles);

  return (
    <View
      style={[
        styles.rail,
        {
          paddingTop: Math.max(insets.top, spacing.lg),
          paddingBottom: Math.max(insets.bottom, spacing.md),
          // A bare `insets.left` here would be 0 in a browser and, being the more specific
          // property, would beat the `paddingRight` sibling's intent and pin the tabs to the
          // window edge. The inset only ever widens the gutter, never removes it.
          paddingLeft: Math.max(insets.left, spacing.md),
        },
      ]}
    >
      <View style={styles.brand}>
        <BrandMark size={40} />
      </View>

      {/* Rings the tabs and not the whole rail — the brand mark above them is not what the
          step is about. Shares its id with the dock; only one of the two ever exists. */}
      <TourTarget id="nav.bar">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;

          return (
            <RailTab
              key={route.key}
              focused={focused}
              label={options.title ?? route.name}
              icon={options.tabBarIcon}
              onPress={() => pressTab(props, index)}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            />
          );
        })}
      </TourTarget>
    </View>
  );
}

interface RailTabProps {
  focused: boolean;
  label: string;
  icon: BottomTabBarProps['descriptors'][string]['options']['tabBarIcon'];
  onPress: () => void;
  onLongPress: () => void;
}

function RailTab({ focused, label, icon, onPress, onLongPress }: RailTabProps) {
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);
  const tint = focused ? colors.textOnAccent : colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={[styles.tab, focused && styles.tabSelected]}
    >
      {icon?.({ focused, color: tint, size: 24 })}
      {/* Armenian and Russian both run longer than the English these widths were eyeballed
          against, so the label is allowed a second line rather than being truncated. */}
      <Text style={[styles.label, { color: tint }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const RAIL_WIDTH = 232;

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    // A fixed width, not a fraction: the rail holds four fixed labels, and letting it track
    // the window would leave a 2560px screen with a quarter-empty column of navigation.
    rail: {
      width: RAIL_WIDTH,
      backgroundColor: c.surface,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: c.border,
      // Left gutter is applied inline so it can absorb a landscape notch inset.
      paddingRight: spacing.md,
    },
    brand: {
      paddingLeft: spacing.sm,
      paddingBottom: spacing.xl,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md - 2,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      marginBottom: spacing.xs,
    },
    tabSelected: {
      backgroundColor: c.primary,
    },
    label: {
      ...typography.labelStrong,
      // The row is `flex-start`, so without this a two-line label pushes its own width past
      // the rail instead of wrapping inside it.
      flexShrink: 1,
    },
  });
