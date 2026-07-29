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
 * The confirmation for the one button in the app that cannot be undone.
 *
 * Two things have to be typed before it will submit: the wipe password, which the server
 * checks, and the word the dialog names, which nothing checks but the dialog itself. The
 * second exists because the first can be muscle memory — a password manager fills it, a
 * finger slips, and the platform is empty. Copying a word out of a warning cannot happen
 * by accident.
 *
 * The scrim is inert here for the same reason: this dialog is dismissed by its own Cancel
 * button, never by a stray tap that could have been aimed at the field behind it.
 */
export function WipeDataModal({ visible, submitting, onClose, onConfirm }: Props) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const requiredWord = t('moderation.wipe.confirmWord');
  // Spelled out rather than summarised as "everything": the word is easy to nod past, and
  // seeing "balances" and "uploaded files" named individually is what makes someone stop.
  const items = t('moderation.wipe.items', { returnObjects: true }) as string[];

  // Neither field survives the dialog closing: a password left in state would still be
  // there the next time it opens, one tap away from running.
  useEffect(() => {
    if (!visible) {
      setPassword('');
      setConfirmation('');
    }
  }, [visible]);

  const isValid = password.length > 0 && confirmation.trim().toUpperCase() === requiredWord;

  return (
    <Dialog visible={visible} onClose={onClose} dismissable={false}>
      <ScrollView style={styles.modalCard} contentContainerStyle={styles.modalContent}>
        <Text style={styles.title}>{t('moderation.wipe.title')}</Text>
        <Text style={styles.warning}>{t('moderation.wipe.warning')}</Text>
        <View style={styles.itemList}>
          {items.map((item) => (
            <Text key={item} style={styles.item}>
              {`•  ${item}`}
            </Text>
          ))}
        </View>
        <Text style={styles.note}>{t('moderation.wipe.keepsAdmin')}</Text>
        <TextField
          label={t('moderation.wipe.passwordLabel')}
          placeholder={t('moderation.wipe.passwordPlaceholder')}
          value={password}
          onChangeText={setPassword}
          secureToggle
          autoComplete="off"
          autoCapitalize="none"
        />
        <TextField
          label={t('moderation.wipe.confirmLabel', { word: requiredWord })}
          placeholder={requiredWord}
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <PrimaryButton
          title={t('moderation.wipe.action')}
          onPress={() => onConfirm(password)}
          loading={submitting}
          disabled={!isValid}
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
      // The whole card is outlined in the danger colour, so the dialog is recognisable as
      // the dangerous one before a word of it has been read.
      borderWidth: 1,
      borderColor: c.danger,
    },
    modalContent: {
      padding: spacing.lg,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: c.danger,
      marginBottom: spacing.sm,
    },
    warning: {
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
