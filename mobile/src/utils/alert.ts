import { Alert, Platform } from 'react-native';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertRequest {
  id: number;
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

type AlertListener = (request: AlertRequest) => void;

let listener: AlertListener | null = null;
let nextId = 1;

/**
 * `AlertHost` claims the channel while it is mounted. Only one host exists — it lives at the
 * root of the app — so a plain reference is enough; no need for a set of subscribers.
 */
export function subscribeToAlerts(fn: AlertListener) {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

/**
 * Shows a message over the app.
 *
 * Every message goes through the in-app dialog rendered by `AlertHost`, on web and on native
 * alike: react-native-web's `Alert.alert` is a no-op, and the browser dialogs it was routed
 * through instead announced themselves as coming from `…onrender.com` and could not be
 * themed or dismissed by clicking away.
 *
 * The platform dialogs remain as a fallback for the window before the host mounts — a failure
 * during startup would otherwise be swallowed.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (listener) {
    listener({ id: nextId++, title, message, buttons });
    return;
  }
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
