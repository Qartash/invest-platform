import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Holding } from '../types';
import { spacing, ThemeColors, useThemeStyles } from '../theme';
import { Dialog } from './ui';
import { PrimaryButton } from './PrimaryButton';
import { TextField } from './TextField';

interface Props {
  holding: Holding | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (quantity: number, askingPrice: number) => void;
}

export function SellTicketModal({ holding, submitting, onClose, onConfirm }: Props) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState('');
  const [askingPrice, setAskingPrice] = useState('');

  useEffect(() => {
    if (holding) {
      setQuantity(String(holding.quantity));
      setAskingPrice('');
    }
  }, [holding]);

  const parsedQuantity = Math.max(0, parseInt(quantity, 10) || 0);
  const parsedPrice = parseFloat(askingPrice);
  const maxQuantity = holding?.quantity ?? 0;
  const isValid = parsedQuantity > 0 && parsedQuantity <= maxQuantity && parsedPrice > 0;

  return (
    <Dialog visible={!!holding} onClose={onClose}>
      <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{t('portfolio.listForSale')}</Text>
          {maxQuantity > 1 && (
            <TextField
              label={t('portfolio.sellQuantityLabel')}
              hint={t('portfolio.availableToSell', { max: maxQuantity })}
              keyboardType="number-pad"
              format="integer"
              placeholder="1"
              value={quantity}
              onChangeText={setQuantity}
            />
          )}
          <TextField
            label={t('portfolio.askingPriceLabel')}
            keyboardType="decimal-pad"
            format="decimal"
            placeholder="0"
            value={askingPrice}
            onChangeText={setAskingPrice}
          />
          <PrimaryButton
            title={t('portfolio.listForSale')}
            onPress={() => onConfirm(parsedQuantity, parsedPrice)}
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
  });
