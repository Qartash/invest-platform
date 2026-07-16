import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { updateMe, uploadAvatar } from '../api/users';
import { showAlert } from '../utils/alert';
import { spacing, ThemeColors, useThemeStyles } from '../theme';
import { PrimaryButton } from './PrimaryButton';
import { Avatar } from './Avatar';
import { AuthUser } from '../types';

const EMOJI_OPTIONS = ['😀', '😎', '🤓', '🦁', '🐯', '🐼', '🦊', '🐸', '🚀', '💼', '🌟', '🔥', '💎', '🏆', '🎯', '🌈'];

interface Props {
  visible: boolean;
  onClose: () => void;
  onUpdated: (user: AuthUser) => void;
}

export function AvatarPickerModal({ visible, onClose, onUpdated }: Props) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setBusy(true);
    try {
      const updated = await uploadAvatar({
        uri: asset.uri,
        name: asset.fileName ?? 'avatar.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      onUpdated(updated);
      onClose();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setBusy(false);
    }
  };

  const handlePickEmoji = async (emoji: string) => {
    setBusy(true);
    try {
      const updated = await updateMe({ avatarEmoji: emoji });
      onUpdated(updated);
      onClose();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('profile.chooseAvatarTitle')}</Text>

          <PrimaryButton title={t('profile.uploadPhoto')} onPress={handlePickPhoto} loading={busy} />

          <Text style={styles.orLabel}>{t('profile.orChooseIcon')}</Text>
          <View style={styles.grid}>
            {EMOJI_OPTIONS.map((emoji) => (
              <Pressable key={emoji} style={styles.emojiCell} onPress={() => handlePickEmoji(emoji)} disabled={busy}>
                <Avatar avatarEmoji={emoji} size={44} />
              </Pressable>
            ))}
          </View>

          <View style={{ height: spacing.sm }} />
          <PrimaryButton title={t('common.close')} variant="outline" onPress={onClose} />
        </View>
      </View>
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
      borderRadius: 14,
      padding: spacing.lg,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
      marginBottom: spacing.md,
    },
    orLabel: {
      fontSize: 13,
      color: c.textMuted,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    emojiCell: {
      margin: spacing.xs,
    },
  });
