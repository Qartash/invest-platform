import { apiClient } from './client';
import { LocalizedText } from '../types';

/** Where money can sit. Mirrors LedgerAccount on the server. */
export type LedgerAccount =
  | 'external'
  | 'platform'
  | 'user_balance'
  | 'user_invest'
  | 'project_treasury'
  | 'project_spendable'
  | 'work_escrow';

/** Why it moved. Mirrors MovementKind on the server. */
export type MovementKind =
  | 'deposit'
  | 'withdrawal'
  | 'ticket_purchase'
  | 'ticket_resale'
  | 'stage_release'
  | 'founder_withdrawal'
  | 'project_refund'
  | 'work_escrow_hold'
  | 'work_payment'
  | 'work_escrow_return'
  | 'dividend'
  | 'reward'
  | 'referral_bonus'
  | 'partner_settlement'
  | 'platform_funding';

export const MOVEMENT_KINDS: MovementKind[] = [
  'deposit',
  'withdrawal',
  'ticket_purchase',
  'ticket_resale',
  'stage_release',
  'founder_withdrawal',
  'project_refund',
  'work_escrow_hold',
  'work_payment',
  'work_escrow_return',
  'dividend',
  'reward',
  'referral_bonus',
  'partner_settlement',
  'platform_funding',
];

export interface Movement {
  id: string;
  kind: MovementKind;
  amount: number;
  fromAccount: LedgerAccount;
  fromUserId: string | null;
  fromProjectId: string | null;
  toAccount: LedgerAccount;
  toUserId: string | null;
  toProjectId: string | null;
  workId: string | null;
  description: string | null;
  createdAt: string;
  fromUserName: string | null;
  fromUsername: string | null;
  toUserName: string | null;
  toUsername: string | null;
  fromProjectTitle: LocalizedText | null;
  toProjectTitle: LocalizedText | null;
}

export interface LedgerSummary {
  /** The pool behind every reward, streak bonus, draw prize and referral bonus. */
  platform: number;
  userBalances: number;
  userInvest: number;
  projectTreasuries: number;
  projectSpendable: number;
  workEscrow: number;
  /** Everything above, added up: all the money currently on the platform. */
  held: number;
  emittedIn: number;
  emittedOut: number;
  netEmitted: number;
  /**
   * Money the ledger cannot account for — held, minus what was recorded as
   * entering from outside. Balances that existed before the ledger did land
   * here; anything that makes it grow afterwards is a movement someone forgot
   * to record.
   */
  unaccounted: number;
  movements: number;
  since: string | null;
}

export interface MovementPage {
  total: number;
  page: number;
  pageSize: number;
  items: Movement[];
}

export function fetchLedgerSummary() {
  return apiClient.get<LedgerSummary>('/ledger/summary').then((r) => r.data);
}

export function fetchMovements(params: { page?: number; kind?: MovementKind } = {}) {
  return apiClient.get<MovementPage>('/ledger/movements', { params }).then((r) => r.data);
}

export function fundPlatformAccount(amount: number, note?: string) {
  return apiClient.post<{ balance: number }>('/ledger/fund', { amount, note }).then((r) => r.data);
}
