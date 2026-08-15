import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Line, Path, Stop, Circle, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { ThemeColors, useTheme, useThemeStyles } from '../theme';
import { formatDate } from '../utils/date';
import { SeriesPoint } from '../api/stats';

interface Props {
  points: SeriesPoint[];
  width: number;
  height?: number;
  color?: string;
}

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${Math.round(value)}`;
}

export function TrendChart({ points, width, height = 180, color }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  // Defaulted here rather than in the signature: a default parameter is evaluated before
  // the palette is available from the context.
  const lineColor = color ?? colors.primary;

  if (points.length === 0) {
    return <Text style={styles.empty}>{t('reports.noData')}</Text>;
  }

  const padding = { top: 14, right: 12, bottom: 22, left: 46 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = points.map((p) => p.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || maxValue || 1;

  const n = points.length;
  const xForIndex = (i: number) => padding.left + (n <= 1 ? chartWidth / 2 : (i / (n - 1)) * chartWidth);
  const yForValue = (value: number) => padding.top + chartHeight - ((value - minValue) / range) * chartHeight;

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xForIndex(i).toFixed(1)} ${yForValue(p.value).toFixed(1)}`)
    .join(' ');

  const baseline = padding.top + chartHeight;
  const areaPath =
    n <= 1
      ? ''
      : `${linePath} L ${xForIndex(n - 1).toFixed(1)} ${baseline} L ${xForIndex(0).toFixed(1)} ${baseline} Z`;

  const lastX = xForIndex(n - 1);
  const lastY = yForValue(points[n - 1].value);

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity={0.28} />
            <Stop offset="1" stopColor={lineColor} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        {/* faint gridlines top / mid / bottom */}
        {[0, 0.5, 1].map((f) => (
          <Line
            key={f}
            x1={padding.left}
            y1={padding.top + f * chartHeight}
            x2={width - padding.right}
            y2={padding.top + f * chartHeight}
            stroke={colors.border}
            strokeWidth={1}
          />
        ))}

        <SvgText x={4} y={padding.top + 4} fontSize={10} fill={colors.textMuted}>
          {formatCompact(maxValue)}
        </SvgText>
        <SvgText x={4} y={baseline} fontSize={10} fill={colors.textMuted}>
          {formatCompact(minValue)}
        </SvgText>

        {areaPath ? <Path d={areaPath} fill="url(#trendFill)" /> : null}
        <Path d={linePath} stroke={lineColor} strokeWidth={2} fill="none" />
        <Circle cx={lastX} cy={lastY} r={3.5} fill={lineColor} />

        <SvgText x={padding.left} y={height - 6} fontSize={9} fill={colors.textMuted}>
          {formatDate(points[0].date, i18n.language)}
        </SvgText>
        {n > 1 && (
          <SvgText x={width - padding.right} y={height - 6} fontSize={9} fill={colors.textMuted} textAnchor="end">
            {formatDate(points[n - 1].date, i18n.language)}
          </SvgText>
        )}
      </Svg>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    empty: {
      textAlign: 'center',
      color: c.textMuted,
      fontSize: 13,
      paddingVertical: 40,
    },
  });
