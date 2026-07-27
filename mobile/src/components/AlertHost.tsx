import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ColorSchemeName,
  focusRing,
  maxWidth,
  PressableState,
  radius,
  shadow,
  spacing,
  ThemeColors,
  typography,
  useThemeStyles,
} from '../theme';
import { Dialog } from './ui';
import { AlertButton, AlertRequest, subscribeToAlerts } from '../utils/alert';

/**
 * Renders every `showAlert` call as an in-app dialog.
 *
 * Mounted once, at the root. Messages are queued rather than replaced: a confirm button whose
 * handler fails raises its own error message while the first one is still on screen, and the
 * second must not be dropped.
 */
export function AlertHost() {
  const [queue, setQueue] = useState<AlertRequest[]>([]);
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();

  useEffect(() => subscribeToAlerts((request) => setQueue((prev) => [...prev, request])), []);

  const current = queue[0];

  const dismiss = useCallback((button?: AlertButton) => {
    setQueue((prev) => prev.slice(1));
    button?.onPress?.();
  }, []);

  // A press on the scrim, or Escape, is a decline: it runs the cancel button if the caller
  // offered one and nothing otherwise. Callers only attach handlers to buttons that sit
  // alongside a cancel, so a stray tap can never confirm anything.
  const handleClose = useCallback(
    () => dismiss(current?.buttons?.find((b) => b.style === 'cancel')),
    [current, dismiss],
  );

  // A message with no buttons is an acknowledgement — give it the one button it implies.
  const buttons: AlertButton[] = current?.buttons?.length ? current.buttons : [{ text: t('common.ok') }];
  const asRow = buttons.length === 2;

  return (
    <Dialog visible={!!current} onClose={handleClose} maxWidth={maxWidth.dialogSm}>
      <View style={styles.card}>
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          // Only takes over when the message is long enough to overflow the window.
          style={styles.bodyScroll}
        >
          <Text style={styles.title}>{current?.title}</Text>
          {!!current?.message && <Text style={styles.message}>{current.message}</Text>}
        </ScrollView>
        <View style={[styles.actions, asRow ? styles.actionsRow : styles.actionsColumn]}>
          {buttons.map((button, index) => (
            <AlertAction
              key={`${button.text}-${index}`}
              button={button}
              styles={styles}
              stretch={asRow}
              onPress={() => dismiss(button)}
            />
          ))}
        </View>
      </View>
    </Dialog>
  );
}

interface ActionProps {
  button: AlertButton;
  styles: ReturnType<typeof createStyles>;
  stretch: boolean;
  onPress: () => void;
}

function AlertAction({ button, styles, stretch, onPress }: ActionProps) {
  const isCancel = button.style === 'cancel';
  const isDestructive = button.style === 'destructive';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered, focused }: PressableState) => [
        styles.action,
        stretch && styles.actionStretch,
        isCancel ? styles.actionCancel : isDestructive ? styles.actionDestructive : styles.actionDefault,
        hovered && !pressed && styles.actionHovered,
        pressed && styles.actionPressed,
        focused && styles.actionFocused,
      ]}
    >
      <Text style={[styles.actionText, isCancel && styles.actionTextCancel]}>{button.text}</Text>
    </Pressable>
  );
}

const createStyles = (c: ThemeColors, scheme: ColorSchemeName) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: spacing.lg,
      ...shadow(scheme),
    },
    bodyScroll: {
      flexGrow: 0,
    },
    body: {
      paddingBottom: spacing.md,
    },
    title: {
      ...typography.heading,
      color: c.text,
      textAlign: 'center',
    },
    message: {
      ...typography.body,
      color: c.textMuted,
      textAlign: 'center',
      lineHeight: 21,
      marginTop: spacing.sm,
    },
    actions: {
      gap: spacing.sm,
    },
    actionsRow: {
      flexDirection: 'row',
    },
    actionsColumn: {
      flexDirection: 'column',
    },
    action: {
      borderRadius: radius.lg,
      paddingVertical: spacing.sm + 4,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Two buttons share the width evenly; three or more stack and are full width already.
    actionStretch: {
      flex: 1,
    },
    actionDefault: {
      backgroundColor: c.primary,
    },
    actionDestructive: {
      backgroundColor: c.danger,
    },
    actionCancel: {
      backgroundColor: c.surfaceSunken,
      borderWidth: 1,
      borderColor: c.border,
    },
    actionHovered: {
      opacity: 0.9,
    },
    actionPressed: {
      opacity: 0.8,
    },
    actionFocused: focusRing(c),
    actionText: {
      ...typography.bodyStrong,
      color: c.textOnAccent,
    },
    actionTextCancel: {
      color: c.text,
    },
  });
