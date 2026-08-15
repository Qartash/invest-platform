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

export interface DemoAccount {
  username: string;
  password: string;
  role: string;
}

export interface SeedDemoResult {
  projectId: string;
  accounts: DemoAccount[];
}

/**
 * Builds one project with everything hanging off it — investors, a treasury, a released
 * stage, hired workers, two months of books — plus the accounts to log in as. Additive,
 * and refuses if the demo project is already there.
 */
export function seedDemoData(password: string) {
  return apiClient.post<SeedDemoResult>('/admin/seed-demo', { password }).then((r) => r.data);
}
