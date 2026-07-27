import { apiClient } from './client';

export type PartnerApplicationStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export interface PartnerTerms {
  flat: number;
  percent: number;
  percentCap: number;
  levels: number;
  paidTo: 'card';
}

export interface PartnerStatus {
  terms: PartnerTerms;
  isPartner: boolean;
  partnerSince: string | null;
  application: {
    id: string;
    status: PartnerApplicationStatus;
    reviewerNote: string | null;
    createdAt: string;
    reviewedAt: string | null;
  } | null;
  // Only present for an approved partner: their cash earnings.
  earnings: { earnedTotal: number; earnedAvailable: number; earnedPending: number } | null;
}

export interface ApplyPartnerInput {
  channelType: string;
  channelUrl: string;
  audienceSize: number;
  topic: string;
  plan: string;
}

export function fetchPartnerStatus() {
  return apiClient.get<PartnerStatus>('/partners/me').then((r) => r.data);
}

export function applyForPartner(data: ApplyPartnerInput) {
  return apiClient.post('/partners/apply', data).then((r) => r.data);
}
