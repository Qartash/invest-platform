import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, ThemeColors } from './tokens';

export type ColorSchemeName = 'light' | 'dark';

/** What the user asked for. 'system' defers to the OS setting. */
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];

const THEME_STORAGE_KEY = 'app_theme';

interface ThemeValue {
  colors: ThemeColors;
  /** The scheme actually being rendered, after resolving 'system'. */
  scheme: ColorSchemeName;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue>({
  colors: lightColors,
  scheme: 'light',
  isDark: false,
  preference: 'system',
  setPreference: () => {},
});

function isPreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme: ColorSchemeName = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  // Read back the stored choice on launch. Until it lands we render 'system', which is the
  // right guess for a first run and only ever a frame or two wrong for everyone else.
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (isPreference(stored)) setPreferenceState(stored);
    });
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next);
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const scheme: ColorSchemeName = preference === 'system' ? systemScheme : preference;
    return {
      colors: scheme === 'dark' ? darkColors : lightColors,
      scheme,
      isDark: scheme === 'dark',
      preference,
      setPreference,
    };
  }, [preference, systemScheme, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

/**
 * Builds themed styles once per scheme change.
 *
 * `StyleSheet.create` at module level captures colors at import time, so a themed screen
 * must build its sheet inside the render. Pass a factory that takes the palette:
 *
 *   const styles = useThemeStyles(createStyles);
 *   const createStyles = (c: ThemeColors) => StyleSheet.create({ ... });
 *
 * Declare the factory at module level (not inline) so the identity stays stable and the
 * sheet is only rebuilt when the scheme actually flips.
 */
export function useThemeStyles<T>(factory: (colors: ThemeColors, scheme: ColorSchemeName) => T): T {
  const { colors, scheme } = useTheme();
  return useMemo(() => factory(colors, scheme), [factory, colors, scheme]);
}
