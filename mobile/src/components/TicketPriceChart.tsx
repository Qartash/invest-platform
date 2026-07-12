import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { colors, spacing } from '../theme';
import { formatDate, formatDateTime } from '../utils/date';

interface PricePoint {
  unitPrice: number;
  quantity?: number;
  totalPrice?: number;
  buyerName?: string;
  date?: string;
}

interface Props {
  points: PricePoint[];
  isProjected?: boolean;
  width?: number;
  height?: number;
}

export function TicketPriceChart({ points, isProjected, width = 320, height = 200 }: Props) {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);

  if (points.length === 0) return null;

  const hasTrades = !isProjected && points.every((p) => p.quantity !== undefined);

  const padding = { top: 24, right: 16, bottom: 40, left: 56 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const prices = points.map((p) => p.unitPrice);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const priceRange = maxPrice - minPrice || maxPrice || 1;

  const quantities = points.map((p) => p.quantity ?? 0);
  const maxQuantity = Math.max(1, ...quantities);

  const n = points.length;
  const xForIndex = (i: number) => padding.left + (n <= 1 ? chartWidth / 2 : (i / (n - 1)) * chartWidth);
  const yForPrice = (price: number) => padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
  const yForQuantity = (qty: number) => padding.top + chartHeight - (qty / maxQuantity) * chartHeight;

  let pricePath = '';
  points.forEach((point, i) => {
    const x = xForIndex(i);
    const y = yForPrice(point.unitPrice);
    if (i === 0) {
      pricePath += `M ${x} ${y}`;
    } else {
      const prevY = yForPrice(points[i - 1].unitPrice);
      pricePath += ` L ${x} ${prevY} L ${x} ${y}`;
    }
  });

  let quantityPath = '';
  if (hasTrades) {
    points.forEach((point, i) => {
      const x = xForIndex(i);
      const y = yForQuantity(point.quantity ?? 0);
      quantityPath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    });
  }

  const lineColor = isProjected ? colors.border : colors.primary;
  const selectedPoint = selected !== null ? points[selected] : null;
  const tooltipWidth = 160;
  const tooltipLeft =
    selected !== null ? Math.min(Math.max(xForIndex(selected) - tooltipWidth / 2, 0), width - tooltipWidth) : 0;
  const tooltipTop = selected !== null ? Math.max(yForPrice(points[selected].unitPrice) - 96, 0) : 0;

  return (
    <View>
      <Svg width={width} height={height}>
        <Line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke={colors.border}
          strokeWidth={1}
        />
        <Line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke={colors.border}
          strokeWidth={1}
        />

        <SvgText x={padding.left} y={12} fontSize={11} fontWeight="700" fill={colors.primary}>
          {t('project.chartPriceAxis')}
        </SvgText>
        {hasTrades && (
          <SvgText x={width - padding.right} y={12} fontSize={11} fontWeight="700" fill={colors.chartAccent} textAnchor="end">
            {t('project.chartQuantityAxis')}
          </SvgText>
        )}

        <SvgText x={4} y={padding.top + 4} fontSize={11} fill={colors.textMuted}>
          {Math.round(maxPrice).toLocaleString()}
        </SvgText>
        <SvgText x={4} y={height - padding.bottom} fontSize={11} fill={colors.textMuted}>
          {Math.round(minPrice).toLocaleString()}
        </SvgText>

        <Path d={pricePath} stroke={lineColor} strokeWidth={2} fill="none" />
        {hasTrades && (
          <Path d={quantityPath} stroke={colors.chartAccent} strokeWidth={2} strokeDasharray="5,4" fill="none" />
        )}

        {!isProjected &&
          points.map((point, i) => (
            <Circle
              key={`price-${i}`}
              cx={xForIndex(i)}
              cy={yForPrice(point.unitPrice)}
              r={selected === i ? 6 : 4}
              fill={colors.primary}
              onPress={() => setSelected(selected === i ? null : i)}
            />
          ))}
        {hasTrades &&
          points.map((point, i) => (
            <Circle
              key={`qty-${i}`}
              cx={xForIndex(i)}
              cy={yForQuantity(point.quantity ?? 0)}
              r={selected === i ? 5 : 3}
              fill={colors.chartAccent}
              onPress={() => setSelected(selected === i ? null : i)}
            />
          ))}

        {points[0]?.date && (
          <SvgText x={padding.left} y={height - padding.bottom + 16} fontSize={10} fill={colors.textMuted}>
            {formatDate(points[0].date, i18n.language)}
          </SvgText>
        )}
        {n > 1 && points[n - 1]?.date && (
          <SvgText
            x={width - padding.right}
            y={height - padding.bottom + 16}
            fontSize={10}
            fill={colors.textMuted}
            textAnchor="end"
          >
            {formatDate(points[n - 1].date!, i18n.language)}
          </SvgText>
        )}
        <SvgText
          x={(padding.left + width - padding.right) / 2}
          y={height - padding.bottom + 32}
          fontSize={10}
          fontWeight="600"
          fill={colors.textMuted}
          textAnchor="middle"
        >
          {t('project.chartTimeAxis')}
        </SvgText>
      </Svg>

      {hasTrades && (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>{t('project.chartPriceAxis')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotDashed, { borderColor: colors.chartAccent }]} />
            <Text style={styles.legendText}>{t('project.chartQuantityAxis')}</Text>
          </View>
        </View>
      )}

      {selectedPoint && (
        <Pressable
          style={[styles.tooltip, { left: tooltipLeft, top: tooltipTop, width: tooltipWidth }]}
          onPress={() => setSelected(null)}
        >
          {selectedPoint.buyerName && <Text style={styles.tooltipTitle}>{selectedPoint.buyerName}</Text>}
          {selectedPoint.quantity !== undefined && (
            <Text style={styles.tooltipText}>
              {t('project.chartTooltipQuantity', { quantity: selectedPoint.quantity })}
            </Text>
          )}
          <Text style={styles.tooltipText}>
            {t('project.chartTooltipUnitPrice', {
              price: selectedPoint.unitPrice.toLocaleString(),
              currency: t('common.currency'),
            })}
          </Text>
          {selectedPoint.totalPrice !== undefined && (
            <Text style={styles.tooltipTotal}>
              {t('project.chartTooltipTotal', {
                total: selectedPoint.totalPrice.toLocaleString(),
                currency: t('common.currency'),
              })}
            </Text>
          )}
          {selectedPoint.date && (
            <Text style={styles.tooltipDate}>{formatDateTime(selectedPoint.date, i18n.language)}</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  legendRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    marginLeft: 56,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.xs,
  },
  legendDotDashed: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  legendText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: colors.text,
    borderRadius: 10,
    padding: spacing.sm,
  },
  tooltipTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.surface,
    marginBottom: 2,
  },
  tooltipText: {
    fontSize: 12,
    color: colors.surface,
  },
  tooltipTotal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.surface,
    marginTop: 2,
  },
  tooltipDate: {
    fontSize: 11,
    color: colors.border,
    marginTop: 2,
  },
});
