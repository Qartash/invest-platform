import { apiClient } from './client';

export interface PeriodBreakdown {
  total: number;
  day: number;
  week: number;
  month: number;
  year: number;
}

export interface LatestUser {
  id: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  avatarEmoji: string | null;
  role: string;
  createdAt: string;
}

export interface UsersStats {
  registered: PeriodBreakdown;
  latest: LatestUser[];
}

export interface UserMoneyTotal {
  id: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  avatarEmoji: string | null;
  amount: number;
  count: number;
}

export interface MoneyHistoryEntry {
  id: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  createdAt: string;
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  avatarEmoji: string | null;
}

export interface MoneyStats {
  turnover: PeriodBreakdown;
  deposits: PeriodBreakdown;
  withdrawals: PeriodBreakdown;
  depositors: UserMoneyTotal[];
  withdrawers: UserMoneyTotal[];
  history: MoneyHistoryEntry[];
}

export function fetchUsersStats() {
  return apiClient.get<UsersStats>('/stats/users').then((r) => r.data);
}

export function fetchMoneyStats() {
  return apiClient.get<MoneyStats>('/stats/money').then((r) => r.data);
}
