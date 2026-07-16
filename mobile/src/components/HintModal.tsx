import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing, ThemeColors, useThemeStyles } from '../theme';

interface Props {
  hint: { title: string; description: string } | null;
  onClose: () => void;
}

export function HintModal({ hint, onClose }: Props) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();

  return (
    <Modal visible={!!hint} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.iconBadge}>
            <Text style={styles.iconText}>ⓘ</Text>
          </View>
          <Text style={styles.title}>{hint?.title}</Text>
          <Text style={styles.description}>{hint?.description}</Text>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>{t('common.close')}</Text>
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
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: spacing.lg,
      alignItems: 'center',
    },
    iconBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    iconText: {
      fontSize: 18,
      color: c.primary,
      fontWeight: '700',
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: c.text,
      marginBottom: spacing.xs,
      textAlign: 'center',
    },
    description: {
      fontSize: 14,
      color: c.textMuted,
      textAlign: 'center',
      marginBottom: spacing.md,
      lineHeight: 20,
    },
    closeButton: {
      alignSelf: 'stretch',
      backgroundColor: c.background,
      borderRadius: 10,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    closeText: {
      color: c.primary,
      fontWeight: '600',
      fontSize: 14,
    },
  });
