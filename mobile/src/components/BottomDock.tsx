import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { shadow, spacing, ThemeColors, ColorSchemeName, useTheme, useThemeStyles } from '../theme';

/**
 * The bottom tab bar, drawn as a floating dock instead of a full-width strip.
 *
 * There are no labels: four icons on a two-word app don't need naming, and dropping the
 * captions is what buys the room for the dock to sit off the screen edge. That costs the
 * only affordance telling you which tab you're on, so selection has to be unmistakable —
 * hence a filled pill rather than a tint, and a segment that widens as it fills.
 */
export function BottomDock({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemeStyles(createStyles);

  return (
    <View style={[styles.ground, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.dock}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <DockTab
              key={route.key}
              focused={focused}
              // The title is the only thing naming this tab now that the caption is gone,
              // so it carries the whole accessible label.
              label={options.title ?? route.name}
              icon={options.tabBarIcon}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            />
          );
        })}
      </View>
    </View>
  );
}

interface DockTabProps {
  focused: boolean;
  label: string;
  icon: BottomTabBarProps['descriptors'][string]['options']['tabBarIcon'];
  onPress: () => void;
  onLongPress: () => void;
}

function DockTab({ focused, label, icon, onPress, onLongPress }: DockTabProps) {
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);
  const grow = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    // `flex` can't run on the native driver, but this is four views animating on a tap the
    // user just made — the JS thread is idle at that moment.
    Animated.timing(grow, { toValue: focused ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [focused, grow]);

  const flex = grow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });

  return (
    <Animated.View style={{ flex }}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        style={[styles.tab, focused && styles.tabSelected]}
      >
        {icon?.({
          focused,
          color: focused ? colors.textOnAccent : colors.textMuted,
          // Well past the 24 a stock tab bar uses: with the captions gone the icon is the
          // whole target, and it has a 72pt pill around it to fill.
          size: 35,
        })}
      </Pressable>
    </Animated.View>
  );
}

// The dock is sized from these rather than from its children: leaving the height to be
// inferred collapsed the bar to its own padding on Android, so the icons overhung a
// sliver of a pill. Both radii are half a real height too — Android hands `borderRadius`
// to the elevation outline, and a nominal 999 makes it draw the shadow against a shape
// that isn't there.
const TAB_HEIGHT = 72;
const DOCK_PADDING = 9;
const DOCK_HEIGHT = TAB_HEIGHT + DOCK_PADDING * 2;

const createStyles = (c: ThemeColors, scheme: ColorSchemeName) =>
  StyleSheet.create({
    // Matches the screens' background so the dock reads as floating over the page rather
    // than as a bar bolted to the bottom of it.
    ground: {
      backgroundColor: c.background,
      paddingHorizontal: spacing.md - 2,
      paddingTop: spacing.sm,
    },
    dock: {
      flexDirection: 'row',
      height: DOCK_HEIGHT,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: DOCK_HEIGHT / 2,
      padding: DOCK_PADDING,
      ...shadow(scheme),
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: TAB_HEIGHT / 2,
    },
    tabSelected: {
      backgroundColor: c.primary,
    },
  });
