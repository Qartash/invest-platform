import { apiClient } from './client';

export interface WipeResult {
  tablesCleared: number;
  usersDeleted: number;
  filesDeleted: number;
}

/**
 * Empties the platform: every account but the caller's, and everything any of them
 * ever created. Irreversible — the server keeps no copy.
 */
export function wipeAllData(password: string) {
  return apiClient.post<WipeResult>('/admin/wipe', { password }).then((r) => r.data);
}
