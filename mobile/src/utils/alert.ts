import { Alert, Platform } from 'react-native';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

// react-native-web's Alert.alert is a no-op, so route through window.alert/confirm on web.
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS === 'web') {
    const body = message ? `${title}\n\n${message}` : title;
    if (!buttons || buttons.length <= 1) {
      window.alert(body);
      buttons?.[0]?.onPress?.();
      return;
    }
    const cancelButton = buttons.find((b) => b.style === 'cancel');
    const confirmButton = buttons.find((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1];
    if (window.confirm(body)) {
      confirmButton.onPress?.();
    } else {
      cancelButton?.onPress?.();
    }
    return;
  }
  Alert.alert(title, message, buttons);
}
