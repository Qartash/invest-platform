import { apiClient } from './client';
import { LocalizedText } from '../types';

/**
 * The server sends a type and the figures behind it, never a sentence — the
 * wording lives in the locale files under `notifications.items.<type>`, so a
 * notification is read in whatever language the app is in now rather than the
 * one it was in when the thing happened.
 *
 * The type is deliberately a plain string and not a union of the backend's enum:
 * a deployment where the server knows a type this build does not is normal, and
 * a union would only turn that into a type error. Unknown types fall back to a
 * generic line — see NotificationsScreen.
 */
export type NotificationType = string;

export interface NotificationPayload {
  [key: string]: unknown;
  projectId?: string;
  projectTitle?: LocalizedText | string | null;
  workId?: string;
  workTitle?: string | null;
  amount?: number;
  quantity?: number;
  comment?: string | null;
  actorName?: string | null;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  payload: NotificationPayload | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationPage {
  items: AppNotification[];
  total: number;
  page: number;
  pageSize: number;
  unread: number;
}

export function fetchNotifications(page = 1, pageSize = 25) {
  return apiClient
    .get<NotificationPage>('/notifications', { params: { page, pageSize } })
    .then((r) => r.data);
}

export function fetchUnreadCount() {
  return apiClient.get<{ count: number }>('/notifications/unread-count').then((r) => r.data.count);
}

export function markNotificationRead(id: string) {
  return apiClient.post<{ unread: number }>(`/notifications/${id}/read`).then((r) => r.data.unread);
}

export function markAllNotificationsRead() {
  return apiClient.post<{ unread: number }>('/notifications/read-all').then((r) => r.data.unread);
}
