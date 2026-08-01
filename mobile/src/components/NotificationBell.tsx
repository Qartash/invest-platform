import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { focusRing, PressableState, radius, ThemeColors, typography, useTheme, useThemeStyles } from '../theme';
import { Icon } from './ui';
import { useNotificationsStore } from '../store/notificationsStore';

interface Props {
  onPress: () => void;
}

/**
 * The bell in a screen header, with the unread count on it.
 *
 * Refreshed when the screen it sits on comes into focus rather than on a timer:
 * the database this talks to sleeps between requests, and a badge polling in the
 * background is the kind of traffic that keeps it awake for no one's benefit.
 * Coming back to a screen is the moment the number could have changed anyway.
 */
export function NotificationBell({ onPress }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const unread = useNotificationsStore((s) => s.unread);
  const refreshUnread = useNotificationsStore((s) => s.refreshUnread);

  useFocusEffect(
    useCallback(() => {
      void refreshUnread();
    }, [refreshUnread]),
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // The count belongs in the label, not only in the badge: a screen reader
      // announces "notifications", and how many are waiting is the whole point.
      accessibilityLabel={
        unread > 0 ? `${t('notifications.title')}, ${t('notifications.unreadCount', { count: unread })}` : t('notifications.title')
      }
      hitSlop={8}
      style={({ pressed, hovered, focused }: PressableState) => [
        styles.button,
        (pressed || hovered) && styles.buttonActive,
        focused && styles.buttonFocused,
      ]}
    >
      <Icon name="bell" color={colors.primary} size={17} />
      {unread > 0 && (
        <View style={styles.badge}>
          {/* Past ninety-nine the exact figure stops being information and starts
              being a wide badge. */}
          <Text style={styles.badgeText} numberOfLines={1}>
            {unread > 99 ? '99+' : unread}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    // Matches HelpButton, which it stands beside in every header it appears in.
    button: {
      width: 28,
      height: 28,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonActive: {
      backgroundColor: c.primarySoft,
    },
    buttonFocused: focusRing(c),
    badge: {
      position: 'absolute',
      top: -5,
      right: -6,
      minWidth: 17,
      height: 17,
      paddingHorizontal: 4,
      borderRadius: radius.pill,
      backgroundColor: c.danger,
      alignItems: 'center',
      justifyContent: 'center',
      // Keeps the badge legible where it overlaps the bell's own outline.
      borderWidth: 1,
      borderColor: c.background,
    },
    badgeText: {
      ...typography.micro,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '700',
      color: c.textOnAccent,
    },
  });
