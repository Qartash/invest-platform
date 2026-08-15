import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TicketListing } from '../types';
import { spacing, ThemeColors, useThemeStyles } from '../theme';
import { Dialog } from './ui';
import { PrimaryButton } from './PrimaryButton';
import { TextField } from './TextField';

interface Props {
  listing: TicketListing | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
}

export function BuyListingModal({ listing, submitting, onClose, onConfirm }: Props) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState('');

  useEffect(() => {
    if (listing) {
      setQuantity(String(listing.quantity));
    }
  }, [listing]);

  const maxQuantity = listing?.quantity ?? 0;
  const parsedQuantity = Math.max(0, parseInt(quantity, 10) || 0);
  const isValid = parsedQuantity > 0 && parsedQuantity <= maxQuantity;
  const totalPrice = listing ? Math.round(listing.unitPrice * parsedQuantity * 100) / 100 : 0;

  return (
    <Dialog visible={!!listing} onClose={onClose}>
      <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{t('project.buyListing')}</Text>
          {maxQuantity > 1 && (
            <TextField
              label={t('project.buyQuantityLabel')}
              hint={t('portfolio.availableToSell', { max: maxQuantity })}
              keyboardType="number-pad"
              format="integer"
              placeholder="1"
              value={quantity}
              onChangeText={setQuantity}
            />
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('project.totalCost')}</Text>
            <Text style={styles.totalValue}>
              {totalPrice.toLocaleString()} {t('common.currency')}
            </Text>
          </View>
          <PrimaryButton
            title={t('project.buyListing')}
            onPress={() => onConfirm(parsedQuantity)}
            loading={submitting}
            disabled={!isValid}
          />
          <View style={{ height: spacing.sm }} />
          <PrimaryButton title={t('common.close')} variant="outline" onPress={onClose} />
        </View>
    </Dialog>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    modalCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: spacing.lg,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
      marginBottom: spacing.md,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    totalLabel: {
      color: c.textMuted,
    },
    totalValue: {
      fontWeight: '700',
      color: c.text,
      fontSize: 16,
    },
  });
