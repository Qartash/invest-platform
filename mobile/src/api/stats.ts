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
  historyTotal: number;
}

export interface PaginatedList<T> {
  total: number;
  items: T[];
}

export const STATS_PAGE_SIZE = 20;

export function fetchUsersStats() {
  return apiClient.get<UsersStats>('/stats/users').then((r) => r.data);
}

export function fetchMoneyStats() {
  return apiClient.get<MoneyStats>('/stats/money').then((r) => r.data);
}

export type SeriesRange = 'day' | '5day' | 'month' | 'year' | '5year' | 'max';

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface StatsSeries {
  range: SeriesRange;
  registrations: SeriesPoint[];
  turnover: SeriesPoint[];
  deposits: SeriesPoint[];
  withdrawals: SeriesPoint[];
}

export function fetchStatsSeries(range: SeriesRange) {
  return apiClient.get<StatsSeries>('/stats/series', { params: { range } }).then((r) => r.data);
}

export function fetchLatestUsers(page: number) {
  return apiClient.get<PaginatedList<LatestUser>>('/stats/users/latest', { params: { page } }).then((r) => r.data);
}

export function fetchMoneyHistory(page: number) {
  return apiClient.get<PaginatedList<MoneyHistoryEntry>>('/stats/money/history', { params: { page } }).then((r) => r.data);
}
