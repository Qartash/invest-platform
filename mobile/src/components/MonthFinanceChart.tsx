import React from 'react';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme';

export interface MonthFinancePoint {
  day: number;
  income: number;
  expense: number;
}

interface Props {
  points: MonthFinancePoint[];
  width: number;
  height?: number;
}

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${Math.round(value)}`;
}

// Two cumulative lines over the days of a month: running income (green) and
// running expenses (red). The gap between them is the running net result.
export function MonthFinanceChart({ points, width, height = 160 }: Props) {
  const { colors } = useTheme();
  if (points.length === 0) {
    return null;
  }

  const padding = { top: 12, right: 12, bottom: 20, left: 46 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxValue =
    Math.max(0, ...points.map((p) => Math.max(p.income, p.expense))) || 1;

  const n = points.length;
  const xForIndex = (i: number) => padding.left + (n <= 1 ? chartWidth / 2 : (i / (n - 1)) * chartWidth);
  const yForValue = (value: number) => padding.top + chartHeight - (value / maxValue) * chartHeight;

  const buildPath = (selector: (p: MonthFinancePoint) => number) =>
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xForIndex(i).toFixed(1)} ${yForValue(selector(p)).toFixed(1)}`)
      .join(' ');

  const incomePath = buildPath((p) => p.income);
  const expensePath = buildPath((p) => p.expense);
  const baseline = padding.top + chartHeight;

  const last = points[n - 1];

  return (
    <Svg width={width} height={height}>
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
        0
      </SvgText>

      <Path d={expensePath} stroke={colors.danger} strokeWidth={2} fill="none" />
      <Path d={incomePath} stroke={colors.success} strokeWidth={2} fill="none" />
      <Circle cx={xForIndex(n - 1)} cy={yForValue(last.expense)} r={3} fill={colors.danger} />
      <Circle cx={xForIndex(n - 1)} cy={yForValue(last.income)} r={3} fill={colors.success} />

      <SvgText x={padding.left} y={height - 5} fontSize={9} fill={colors.textMuted}>
        {points[0].day}
      </SvgText>
      {n > 1 && (
        <SvgText x={width - padding.right} y={height - 5} fontSize={9} fill={colors.textMuted} textAnchor="end">
          {last.day}
        </SvgText>
      )}
    </Svg>
  );
}
