import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing, ThemeColors, useThemeStyles } from '../theme';
import { formatMonth, usesArmenianFallback } from '../utils/date';

interface Props {
  visible: boolean;
  value?: string | null; // YYYY-MM-DD
  onClose: () => void;
  onSelect: (date: string) => void;
}

const LOCALE_MAP: Record<string, string> = { hy: 'hy-AM', ru: 'ru-RU', en: 'en-US' };

// Monday-first, matching the calendar grid below. Spelled out for the same reason as the
// month names in utils/date.ts: where Armenian is absent from the runtime's ICU data,
// `hy-AM` resolves to `ru` and the calendar would be headed with Russian weekdays.
const HY_WEEKDAYS_SHORT = ['երկ', 'երք', 'չրք', 'հնգ', 'ուրբ', 'շբթ', 'կիր'];

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// A pure-JS calendar so date-of-birth selection ships over-the-air without a
// native date-picker dependency (which would need a new build).
export function DatePickerModal({ visible, value, onClose, onSelect }: Props) {
  const styles = useThemeStyles(createStyles);
  const { i18n } = useTranslation();
  const locale = LOCALE_MAP[i18n.language] ?? 'en-US';
  const today = new Date();

  const initial = value ? new Date(value) : new Date(today.getFullYear() - 25, today.getMonth(), 1);
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const selected = value ?? null;

  const weekdayLabels = useMemo(() => {
    if (usesArmenianFallback(i18n.language)) return HY_WEEKDAYS_SHORT;
    // Monday-first week; take short weekday names from the active locale.
    const base = new Date(2023, 0, 2); // a Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d.toLocaleDateString(locale, { weekday: 'short' });
    });
  }, [locale, i18n.language]);

  const monthTitle = formatMonth(
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`,
    i18n.language,
  );

  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    // JS getDay(): 0=Sun..6=Sat; convert to Monday-first offset.
    const leading = (firstDay.getDay() + 6) % 7;
    const arr: Array<number | null> = Array.from({ length: leading }, () => null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [viewYear, viewMonth]);

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const isFuture = (day: number) => new Date(viewYear, viewMonth, day) > today;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={styles.navButton}>
              <Text style={styles.navText}>‹</Text>
            </Pressable>
            <Text style={styles.monthTitle}>{monthTitle}</Text>
            <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={styles.navButton}>
              <Text style={styles.navText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.yearRow}>
            <Pressable onPress={() => setViewYear((y) => y - 1)} hitSlop={8}>
              <Text style={styles.yearArrow}>«</Text>
            </Pressable>
            <Text style={styles.yearLabel}>{viewYear}</Text>
            <Pressable onPress={() => setViewYear((y) => Math.min(y + 1, today.getFullYear()))} hitSlop={8}>
              <Text style={styles.yearArrow}>»</Text>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {weekdayLabels.map((label, i) => (
              <Text key={i} style={styles.weekday}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (day === null) return <View key={`e${i}`} style={styles.cell} />;
              const iso = toIso(viewYear, viewMonth, day);
              const isSelected = iso === selected;
              const disabled = isFuture(day);
              return (
                <Pressable
                  key={iso}
                  style={styles.cell}
                  disabled={disabled}
                  onPress={() => {
                    onSelect(iso);
                    onClose();
                  }}
                >
                  <View style={[styles.dayInner, isSelected && styles.dayInnerSelected]}>
                    <Text
                      style={[
                        styles.dayText,
                        isSelected && styles.dayTextSelected,
                        disabled && styles.dayTextDisabled,
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: spacing.md,
      width: '100%',
      maxWidth: 360,
      alignSelf: 'center',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    navButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.background,
    },
    navText: {
      fontSize: 22,
      color: c.text,
      lineHeight: 24,
    },
    monthTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: c.text,
      textTransform: 'capitalize',
    },
    yearRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    yearArrow: {
      fontSize: 16,
      color: c.primary,
      fontWeight: '700',
      paddingHorizontal: spacing.md,
    },
    yearLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textMuted,
      minWidth: 56,
      textAlign: 'center',
    },
    weekRow: {
      flexDirection: 'row',
      marginBottom: spacing.xs,
    },
    weekday: {
      flex: 1,
      textAlign: 'center',
      fontSize: 11,
      fontWeight: '600',
      color: c.textMuted,
      textTransform: 'capitalize',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    cell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayInner: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayInnerSelected: {
      backgroundColor: c.primary,
    },
    dayText: {
      fontSize: 14,
      color: c.text,
    },
    dayTextSelected: {
      color: c.textOnAccent,
      fontWeight: '700',
    },
    dayTextDisabled: {
      color: c.border,
    },
  });
