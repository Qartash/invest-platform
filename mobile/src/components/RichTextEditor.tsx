import React, { Suspense } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { spacing, ThemeColors, useThemeStyles } from '../theme';

export interface RichTextEditorProps {
  value: string;
  onChangeText: (html: string) => void;
  placeholder?: string;
}

/**
 * The editor itself is the single heaviest thing the app ships — tentap, Tiptap and a
 * webview shim — and it appears on three screens: creating a project, editing a profile and
 * moderating one. Everyone else was downloading it anyway, because a single bundle has no
 * way to leave anything out.
 *
 * Splitting it off means the import below becomes its own file that Metro fetches the first
 * time one of those screens renders. The fallback holds the same space the editor will take
 * so the form around it does not jump when the chunk arrives.
 */
const Editor = React.lazy(async () => {
  const module = await import('./RichTextEditorImpl');
  return { default: module.RichTextEditor };
});

export function RichTextEditor(props: RichTextEditorProps) {
  const styles = useThemeStyles(createStyles);

  return (
    <Suspense
      fallback={
        <View style={styles.placeholder}>
          <ActivityIndicator />
        </View>
      }
    >
      <Editor {...props} />
    </Suspense>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    placeholder: {
      // Toolbar plus the editor's own fixed 220 — see the height set in the impl.
      height: 260,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
