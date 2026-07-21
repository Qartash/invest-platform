import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { radius, spacing, ThemeColors, typography, useTheme, useThemeStyles } from '../../theme';
import { Icon, IconName } from './Icon';
import { logEvent } from '../../utils/logger';

export interface ActionSheetItem {
  key: string;
  label: string;
  icon?: IconName;
  /** Destructive entries render in the danger tone and sit last. */
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title?: string;
  items: ActionSheetItem[];
  onClose: () => void;
}

// The overflow menu behind a card's "…" button. Secondary actions live here so the card
// itself only carries the actions people reach for every time — and so destructive ones
// take a deliberate second tap rather than sitting inline next to a navigation link.
export function ActionSheet({ visible, title, items, onClose }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useTranslation();

  const run = (item: ActionSheetItem) => {
    if (item.disabled) return;
    logEvent('click', item.label, { component: 'ActionSheet', action: item.key });
    onClose();
    item.onPress();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          {!!title && (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          )}
          {items.map((item, index) => (
            <Pressable
              key={item.key}
              onPress={() => run(item)}
              style={({ pressed }) => [
                styles.row,
                index > 0 && styles.rowDivided,
                pressed && !item.disabled && styles.rowPressed,
                item.disabled && styles.rowDisabled,
              ]}
            >
              {item.icon && (
                <Icon
                  name={item.icon}
                  size={18}
                  color={item.destructive ? colors.danger : colors.textMuted}
                />
              )}
              <Text style={[styles.rowLabel, item.destructive && styles.rowLabelDestructive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
          <Pressable style={({ pressed }) => [styles.cancel, pressed && styles.rowPressed]} onPress={onClose}>
            <Text style={styles.cancelLabel}>{t('common.cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radius.xl + 4,
      borderTopRightRadius: radius.xl + 4,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: c.border,
      marginBottom: spacing.sm,
    },
    title: {
      ...typography.eyebrow,
      color: c.textMuted,
      paddingVertical: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 2,
      paddingVertical: spacing.md - 2,
    },
    rowDivided: {
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    rowPressed: {
      opacity: 0.6,
    },
    rowDisabled: {
      opacity: 0.4,
    },
    rowLabel: {
      ...typography.body,
      color: c.text,
    },
    rowLabelDestructive: {
      color: c.danger,
    },
    cancel: {
      marginTop: spacing.sm,
      alignItems: 'center',
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.md,
      backgroundColor: c.surfaceSunken,
    },
    cancelLabel: {
      ...typography.labelStrong,
      color: c.textMuted,
    },
  });
