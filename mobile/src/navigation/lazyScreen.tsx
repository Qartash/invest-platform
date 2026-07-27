import React, { ComponentType, Suspense } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ThemeColors, useThemeStyles } from '../theme';

/**
 * Registers a screen without putting its code in the bundle everyone downloads.
 *
 * Written for the screens only administrators can open: they are some of the largest in the
 * app, they were shipped to every visitor regardless, and the handful of people who do open
 * them can afford to wait a moment the first time. Metro turns each `import()` below into its
 * own file and fetches it when the screen is first rendered.
 *
 * The loader shows a spinner on a plain background rather than a skeleton, because a screen
 * that has not loaded yet cannot know what shape it will be.
 */
// P is left to the call site (a navigator decides what it passes a screen) rather than being
// inferred from the imported module, which would make the import's own props the contract.
export function lazyScreen<P extends object = any>(
  load: () => Promise<{ default: ComponentType<any> }>,
): ComponentType<P> {
  const Lazy = React.lazy(load);

  return function LazyScreen(props: P) {
    const styles = useThemeStyles(createStyles);
    return (
      <Suspense
        fallback={
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        }
      >
        <Lazy {...props} />
      </Suspense>
    );
  };
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.background,
    },
  });
