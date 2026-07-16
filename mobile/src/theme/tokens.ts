import { TextStyle } from 'react-native';

// Neutrals carry a slight green bias so they read as chosen alongside the primary
// rather than as a default system grey.
export const lightColors = {
  primary: '#2E6F45',
  primaryDark: '#1F4E30',
  // Tinted fills for icon plaques, selected tabs and soft badges. Kept opaque-ish via rgba
  // so they sit correctly on both `surface` and `background`.
  primarySoft: 'rgba(46, 111, 69, 0.10)',
  background: '#F6F8F7',
  surface: '#FFFFFF',
  // Raised above `surface` — used for wells and inset rows inside a card.
  surfaceSunken: '#F1F4F2',
  text: '#16201A',
  textMuted: '#6B7A70',
  // For text sitting on a saturated fill — the primary button, but equally a status chip
  // painted success/warning/danger. Those fills lighten in the dark theme, so white would
  // stop being legible on them; this token flips instead.
  textOnAccent: '#FFFFFF',
  textOnAccentMuted: 'rgba(255, 255, 255, 0.82)',
  border: '#E2E7E3',
  success: '#22A559',
  successSoft: 'rgba(34, 165, 89, 0.12)',
  danger: '#DC2626',
  dangerSoft: 'rgba(220, 38, 38, 0.10)',
  warning: '#D97706',
  warningSoft: 'rgba(217, 119, 6, 0.14)',
  chartAccent: '#2563EB',
  // Scrims for content laid over imagery (project cover hero).
  overlayStrong: 'rgba(10, 18, 12, 0.88)',
  overlayFaint: 'rgba(10, 18, 12, 0.05)',
  onOverlay: '#FFFFFF',
  onOverlayMuted: 'rgba(255, 255, 255, 0.92)',
  onOverlayFill: 'rgba(255, 255, 255, 0.16)',
};

// Not a naive inversion: the primary lifts to stay legible on a dark ground, and
// semantic hues desaturate so they don't glare.
export const darkColors: typeof lightColors = {
  primary: '#63B37F',
  primaryDark: '#4C9366',
  primarySoft: 'rgba(99, 179, 127, 0.14)',
  background: '#171C18',
  surface: '#1F2620',
  surfaceSunken: '#161B17',
  text: '#E9EFEA',
  textMuted: '#93A398',
  textOnAccent: '#0E1710',
  textOnAccentMuted: 'rgba(14, 23, 16, 0.72)',
  border: '#2C352E',
  success: '#4ECB7D',
  successSoft: 'rgba(78, 203, 125, 0.14)',
  danger: '#F87171',
  dangerSoft: 'rgba(248, 113, 113, 0.12)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251, 191, 36, 0.14)',
  chartAccent: '#60A5FA',
  overlayStrong: 'rgba(4, 8, 5, 0.90)',
  overlayFaint: 'rgba(4, 8, 5, 0.10)',
  onOverlay: '#FFFFFF',
  onOverlayMuted: 'rgba(255, 255, 255, 0.92)',
  onOverlayFill: 'rgba(255, 255, 255, 0.14)',
};

export type ThemeColors = typeof lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 10,
  lg: 13,
  xl: 16,
  pill: 999,
};

// Replaces the 17 ad-hoc font sizes that had accumulated across the app. Every size
// below is a rung on one scale — reach for the nearest role, don't add a new number.
export const typography = {
  display: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  heading: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  subheading: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  bodyStrong: { fontSize: 15, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '400' },
  labelStrong: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '400' },
  captionStrong: { fontSize: 13, fontWeight: '600' },
  micro: { fontSize: 12, fontWeight: '400' },
  microStrong: { fontSize: 12, fontWeight: '700' },
  // Uppercase section markers. Letter-spacing is what makes small caps legible.
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase' },
} satisfies Record<string, TextStyle>;

// Numbers that sit in columns (money, counts, dates) must not jitter as they change.
export const tabularNums: TextStyle = { fontVariant: ['tabular-nums'] };

export function shadow(colorScheme: 'light' | 'dark') {
  return {
    shadowColor: '#000',
    shadowOpacity: colorScheme === 'dark' ? 0.5 : 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  };
}
