import { Platform, Share } from 'react-native';

// Copies text where we can do it without a native module: the browser's clipboard
// API on web. On native (no clipboard dependency in this build) it reports false so
// the caller can fall back to the share sheet.
export async function copyText(text: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// The OS share sheet on native; on web this is the Web Share API where present.
export function shareText(message: string) {
  return Share.share({ message });
}
