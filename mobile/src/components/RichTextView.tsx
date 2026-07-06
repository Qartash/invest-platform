import React from 'react';
import { Platform, StyleProp, Text, TextStyle } from 'react-native';
import { stripHtml } from '../utils/richText';

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
  if (Platform.OS === 'web') {
    return (
      <HtmlDiv
        style={{
          color: color ?? '#1A1A1A',
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
