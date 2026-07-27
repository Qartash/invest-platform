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

// ── Moderation ──────────────────────────────────────────────────────────────
// The four admin endpoints existed on the backend with nothing calling them, so
// an application could be filed and then never decided: the applicant sat on
// "under review" with no way out of it.

export interface PartnerApplicationForReview {
  id: string;
  status: PartnerApplicationStatus;
  channelType: string;
  channelUrl: string;
  audienceSize: number;
  topic: string;
  plan: string;
  reviewerNote: string | null;
  createdAt: string;
  applicant: { id: string; name: string; memberSince: string };
}

// A partner and what is owed them in cash, with the individual earnings that make
// up the sum — settling takes their ids, not the total.
export interface PartnerPayoutDue {
  userId: string;
  name: string;
  amount: number;
  earningIds: string[];
}

export function fetchPartnerApplications(status?: PartnerApplicationStatus) {
  return apiClient
    .get<PartnerApplicationForReview[]>('/partners/admin/applications', { params: status ? { status } : undefined })
    .then((r) => r.data);
}

// `changes_requested` is a decision too, not a non-answer: the note is what the
// applicant has to act on, so it is required for that outcome and for a rejection.
export function reviewPartnerApplication(id: string, status: PartnerApplicationStatus, note?: string) {
  return apiClient.post(`/partners/admin/applications/${id}/review`, { status, note }).then((r) => r.data);
}

export function revokePartner(userId: string) {
  return apiClient.post(`/partners/admin/${userId}/revoke`).then((r) => r.data);
}

export function fetchPartnerPayoutsDue() {
  return apiClient.get<PartnerPayoutDue[]>('/partners/admin/payouts-due').then((r) => r.data);
}

export function settlePartnerPayout(earningIds: string[]) {
  return apiClient.post<{ settled: number }>('/partners/admin/payouts/settle', { earningIds }).then((r) => r.data);
}
