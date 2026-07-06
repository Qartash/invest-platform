import { LocalizedText } from '../types';

export function getLocalizedText(obj: LocalizedText | undefined, lang: string): string {
  if (!obj) return '';
  return obj[lang] ?? obj.hy ?? Object.values(obj)[0] ?? '';
}
