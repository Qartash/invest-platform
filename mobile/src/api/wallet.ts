import { apiClient } from './client';
import { Wallet } from '../types';

export interface Transaction {
  id: string;
  type: string;
  amount: string;
  quantity: number | null;
  status: string;
  description: string | null;
  account: 'balance' | 'invest' | null;
  createdAt: string;
}

export function fetchWallet() {
  return apiClient.get<Wallet>('/wallet').then((r) => r.data);
}

// Lifetime sums over the whole ledger, not the page on screen. `investCredited`
// is everything ever granted as invest credit — not what is left of it, since
// buying tickets spends it back down.
export interface TransactionTotals {
  deposited: number;
  withdrawn: number;
  investCredited: number;
}

export interface TransactionPage {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  totals: TransactionTotals;
}

export function fetchTransactions(page = 1, pageSize = 10) {
  return apiClient
    .get<TransactionPage>('/wallet/transactions', { params: { page, pageSize } })
    .then((r) => r.data);
}

export function deposit(amount: number) {
  return apiClient.post<Wallet>('/wallet/deposit', { amount }).then((r) => r.data);
}

export function withdraw(amount: number) {
  return apiClient.post<Wallet>('/wallet/withdraw', { amount }).then((r) => r.data);
}
