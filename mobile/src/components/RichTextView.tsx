import React from 'react';
import { Platform, StyleProp, Text, TextStyle } from 'react-native';
import { stripHtml } from '../utils/richText';
import { useTheme } from '../theme';

// Raw DOM tag — on web we render the description's real HTML (bold, lists, etc.)
// instead of showing the tags as literal text.
const HtmlDiv: any = 'div';

interface Props {
  html: string;
  textStyle?: StyleProp<TextStyle>;
  color?: string;
  fontSize?: number;
}

export function RichTextView({ html, textStyle, color, fontSize }: Props) {
  const { colors } = useTheme();
  if (Platform.OS === 'web') {
    return (
      <HtmlDiv
        style={{
          // The raw <div> sits outside RN styling, so the palette has to be handed to it —
          // otherwise every project description stays black text in the dark theme.
          color: color ?? colors.text,
          fontSize: fontSize ?? 15,
          lineHeight: 1.5,
          wordBreak: 'break-word',
        }}
        dangerouslySetInnerHTML={{ __html: html || '' }}
      />
    );
  }
  return <Text style={textStyle}>{stripHtml(html)}</Text>;
}
