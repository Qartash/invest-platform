import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing, ThemeColors, useThemeStyles } from '../theme';
import { PrimaryButton } from './PrimaryButton';
import { Avatar } from './Avatar';

export interface InvestorSummary {
  buyerId: string;
  buyerName: string;
  avatarUrl?: string | null;
  avatarEmoji?: string | null;
  quantity: number;
  amount: number;
}

interface Props {
  visible: boolean;
  investors: InvestorSummary[];
  onClose: () => void;
  onSelect: (buyerId: string) => void;
}

export function InvestorsListModal({ visible, investors, onClose, onSelect }: Props) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('project.investorsListTitle')}</Text>
          <FlatList
            data={investors}
            keyExtractor={(item) => item.buyerId}
            style={styles.list}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => onSelect(item.buyerId)}>
                <View style={styles.avatarWrap}>
                  <Avatar avatarUrl={item.avatarUrl} avatarEmoji={item.avatarEmoji} size={44} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.name}>{item.buyerName}</Text>
                  <Text style={styles.meta}>
                    x{item.quantity} · {item.amount.toLocaleString()} {t('common.currency')}
                  </Text>
                </View>
              </Pressable>
            )}
          />
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
      maxHeight: '75%',
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
      marginBottom: spacing.md,
    },
    list: {
      flexGrow: 0,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    avatarWrap: {
      marginRight: spacing.sm,
    },
    rowText: {
      flex: 1,
    },
    name: {
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
    },
    meta: {
      fontSize: 12,
      color: c.textMuted,
      marginTop: 2,
    },
  });
