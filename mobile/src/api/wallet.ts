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

export function fetchTransactions() {
  return apiClient.get<Transaction[]>('/wallet/transactions').then((r) => r.data);
}

export function deposit(amount: number) {
  return apiClient.post<Wallet>('/wallet/deposit', { amount }).then((r) => r.data);
}

export function withdraw(amount: number) {
  return apiClient.post<Wallet>('/wallet/withdraw', { amount }).then((r) => r.data);
}
