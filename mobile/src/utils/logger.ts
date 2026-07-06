import { sendClientLog } from '../api/logs';

// Fire-and-forget: a logging call must never throw, block, or affect the UI it's attached to.
export function logEvent(
  category: string,
  message: string,
  metadata?: Record<string, any>,
  level?: 'info' | 'warn' | 'error',
): void {
  sendClientLog(category, message, metadata, level).catch(() => {});
}
