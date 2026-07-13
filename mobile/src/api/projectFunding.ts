import { apiClient } from './client';
import { FundReleaseRequest, PendingReleaseRequest } from '../types';

export function fetchReleaseRequests(projectId: string) {
  return apiClient.get<FundReleaseRequest[]>(`/projects/${projectId}/release-requests`).then((r) => r.data);
}

export function requestRelease(projectId: string, data: { budgetItemId: string; note?: string }) {
  return apiClient.post<FundReleaseRequest>(`/projects/${projectId}/release-requests`, data).then((r) => r.data);
}

export function withdrawProjectFunds(projectId: string, amount: number) {
  return apiClient.post(`/projects/${projectId}/funds/withdraw`, { amount }).then((r) => r.data);
}

// --- Moderator ---

export function fetchPendingReleases() {
  return apiClient.get<PendingReleaseRequest[]>('/funding/release-requests').then((r) => r.data);
}

export function decideRelease(requestId: string, approve: boolean, note?: string) {
  return apiClient.post(`/funding/release-requests/${requestId}/decide`, { approve, note }).then((r) => r.data);
}

export function refundProject(projectId: string) {
  return apiClient.post(`/funding/projects/${projectId}/refund`).then((r) => r.data);
}
