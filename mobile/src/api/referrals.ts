import { apiClient } from './client';

export interface ReferralSummary {
  referralCode: string | null;
  directCount: number;
  branchTotal: number;
  maxDepth: number;
  earnedTotal: number;
  earnedAvailable: number;
  earnedPending: number;
  /** Whether this code currently works as an invite. Registration is invite-only. */
  canInvite: boolean;
  inviteHasDeposited: boolean;
  /** Whole days still to wait on the account-age requirement; 0 once it is met. */
  inviteDaysUntilOldEnough: number;
  inviteMinAccountAgeDays: number;
}

export interface ReferralReferrer {
  id: string;
  name: string;
  masked: boolean;
  avatarEmoji: string | null;
  avatarUrl: string | null;
  joinedAt: string;
}

export interface ReferralTreeNode {
  id: string;
  name: string;
  masked: boolean;
  avatarEmoji: string | null;
  avatarUrl: string | null;
  depth: number;
  directCount: number;
  earned: number;
  qualified: boolean;
  joinedAt: string;
  children: ReferralTreeNode[];
}

export type ReferralEarningType = 'level_bonus' | 'deposit_percent';
export type ReferralEarningStatus = 'pending' | 'paid' | 'cancelled';

export interface ReferralEarning {
  id: string;
  sourceName: string;
  masked: boolean;
  level: number;
  type: ReferralEarningType;
  amount: number;
  status: ReferralEarningStatus;
  maturesAt: string;
  createdAt: string;
}

export function fetchReferralSummary() {
  return apiClient.get<ReferralSummary>('/referrals/summary').then((r) => r.data);
}

export function fetchReferrer() {
  return apiClient.get<ReferralReferrer | null>('/referrals/referrer').then((r) => r.data);
}

export function fetchReferralTree(depth = 4) {
  return apiClient.get<ReferralTreeNode[]>('/referrals/tree', { params: { depth } }).then((r) => r.data);
}

export function fetchReferralEarnings() {
  return apiClient.get<ReferralEarning[]>('/referrals/earnings').then((r) => r.data);
}
