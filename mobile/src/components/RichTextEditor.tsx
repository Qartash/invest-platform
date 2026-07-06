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
import { colors, spacing } from '../theme';

interface Props {
  value: string;
  onChangeText: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChangeText, placeholder }: Props) {
  // The placeholder bridge also exposes an imperative `setPlaceholder`, but
  // calling it post-mount doesn't reliably redraw Tiptap's decoration on web.
  // Configuring it into the extension up front avoids that timing issue.
  const bridgeExtensions = useMemo(
    () => [
      ...TenTapStartKit.filter((ext) => ext.name !== 'placeholder'),
      PlaceholderBridge.configureExtension({ placeholder: placeholder ?? '' }),
    ],
    [placeholder],
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

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
