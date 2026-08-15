import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing, ThemeColors, typography, useThemeStyles } from '../theme';
import { Dialog } from './ui';
import { PrimaryButton } from './PrimaryButton';
import { TextField } from './TextField';

interface Props {
  visible: boolean;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
}

/**
 * Asks for the password before filling the platform with demo data.
 *
 * Nothing here deletes anything, so there is no typed confirmation word — unlike its
 * neighbour, a mistaken press costs one wipe to undo. The password is still required:
 * inventing four accounts and a funded project is not something a live platform should
 * be a single tap away from.
 */
export function SeedDemoModal({ visible, submitting, onClose, onConfirm }: Props) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!visible) setPassword('');
  }, [visible]);

  const items = t('moderation.seedDemo.items', { returnObjects: true }) as string[];

  return (
    <Dialog visible={visible} onClose={onClose} dismissable={false}>
      <ScrollView style={styles.modalCard} contentContainerStyle={styles.modalContent}>
        <Text style={styles.title}>{t('moderation.seedDemo.title')}</Text>
        <Text style={styles.intro}>{t('moderation.seedDemo.intro')}</Text>
        <View style={styles.itemList}>
          {items.map((item) => (
            <Text key={item} style={styles.item}>
              {`•  ${item}`}
            </Text>
          ))}
        </View>
        <Text style={styles.note}>{t('moderation.seedDemo.note')}</Text>
        <TextField
          label={t('moderation.wipe.passwordLabel')}
          placeholder={t('moderation.wipe.passwordPlaceholder')}
          value={password}
          onChangeText={setPassword}
          secureToggle
          autoComplete="off"
          autoCapitalize="none"
        />
        <PrimaryButton
          title={t('moderation.seedDemo.action')}
          onPress={() => onConfirm(password)}
          loading={submitting}
          disabled={password.length === 0}
        />
        <View style={styles.gap} />
        <PrimaryButton title={t('common.cancel')} variant="outline" onPress={onClose} />
      </ScrollView>
    </Dialog>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    modalCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
    },
    modalContent: {
      padding: spacing.lg,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
      marginBottom: spacing.sm,
    },
    intro: {
      ...typography.body,
      color: c.text,
      marginBottom: spacing.sm,
    },
    itemList: {
      marginBottom: spacing.sm,
      gap: 2,
    },
    item: {
      ...typography.caption,
      color: c.text,
    },
    note: {
      ...typography.caption,
      color: c.textMuted,
      marginBottom: spacing.md,
    },
    gap: {
      height: spacing.sm,
    },
  });
