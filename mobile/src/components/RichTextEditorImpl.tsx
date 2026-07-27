import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  PlaceholderBridge,
  RichText,
  TenTapStartKit,
  Toolbar,
  useEditorBridge,
  useEditorContent,
} from '@10play/tentap-editor';
import { spacing, ThemeColors, useTheme, useThemeStyles } from '../theme';
import type { RichTextEditorProps } from './RichTextEditor';

// Everything tentap needs lives in this file so it can be split off the first download —
// RichTextEditor.tsx is the thin wrapper that loads it on demand.
export function RichTextEditor({ value, onChangeText, placeholder }: RichTextEditorProps) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  // The placeholder bridge also exposes an imperative `setPlaceholder`, but
  // calling it post-mount doesn't reliably redraw Tiptap's decoration on web.
  // Configuring it into the extension up front avoids that timing issue.
  //
  // The editor's text lives inside a webview and is painted by the library's own CSS, so
  // `theme.webview` alone would leave black text on the dark surface. `configureCSS`
  // *replaces* an extension's CSS rather than appending to it — CoreBridge is the safe
  // place to inject, since it ships no CSS of its own.
  const bridgeExtensions = useMemo(
    () => [
      ...TenTapStartKit.filter((ext) => ext.name !== 'placeholder').map((ext) =>
        ext.name === 'coreBridge'
          ? ext.configureCSS(`.ProseMirror { color: ${colors.text}; caret-color: ${colors.primary}; }`)
          : ext,
      ),
      PlaceholderBridge.configureExtension({ placeholder: placeholder ?? '' }),
    ],
    [placeholder, colors.text, colors.primary],
  );

  // Fixed height with its own internal scroll (rather than `dynamicHeight`,
  // whose resize signal is unreliable on web) — a bounded, independently
  // scrollable editor box is the standard pattern for this kind of input.
  // Background/height must go through `theme.webview` rather than a `style`
  // prop on <RichText> — the library's own style array (which makes the
  // webview fill its container) would otherwise be clobbered by a plain
  // `style` override.
  const editor = useEditorBridge({
    initialContent: value || '',
    bridgeExtensions,
    theme: {
      webview: { backgroundColor: colors.surface, height: 220 },
    },
  });
  const html = useEditorContent(editor, { type: 'html', debounceInterval: 300 });

  useEffect(() => {
    if (html !== undefined) {
      onChangeText(html);
    }
    // Only fire when the debounced content actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  return (
    <View style={styles.wrapper}>
      <Toolbar editor={editor} />
      <RichText editor={editor} />
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      overflow: 'hidden',
    },
  });
