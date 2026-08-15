import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing, ThemeColors, useThemeStyles } from '../theme';
import { Dialog } from './ui';
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
    <Dialog visible={visible} onClose={onClose}>
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
    </Dialog>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: spacing.lg,
      // The dialog already caps at the window; this keeps the list from filling it entirely
      // so the card still reads as a card rather than a takeover.
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
