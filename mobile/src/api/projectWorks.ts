import { apiClient } from './client';
import { ProjectWork, WorkApplication, WorkPaymentType, UserWorks, WorkMilestone, DisputedWork } from '../types';

export function fetchProjectWorks(projectId: string) {
  return apiClient.get<ProjectWork[]>(`/projects/${projectId}/works`).then((r) => r.data);
}

export function createProjectWork(
  projectId: string,
  data: {
    title: string;
    brief: string;
    price: number;
    paymentType?: WorkPaymentType;
    allowCounterOffers?: boolean;
    ticketPremiumPercent?: number;
    budgetItemId?: string;
    deadline?: string;
  },
) {
  return apiClient.post<ProjectWork>(`/projects/${projectId}/works`, data).then((r) => r.data);
}

export function updateProjectWork(
  projectId: string,
  workId: string,
  data: {
    title?: string;
    brief?: string;
    price?: number;
    paymentType?: WorkPaymentType;
    allowCounterOffers?: boolean;
    ticketPremiumPercent?: number;
    budgetItemId?: string;
    deadline?: string;
  },
) {
  return apiClient.patch<ProjectWork>(`/projects/${projectId}/works/${workId}`, data).then((r) => r.data);
}

export function deleteProjectWork(projectId: string, workId: string) {
  return apiClient.delete(`/projects/${projectId}/works/${workId}`).then((r) => r.data);
}

export function applyToWork(
  projectId: string,
  workId: string,
  data: { coverLetter?: string; offeredPrice?: number; preferredPayment?: WorkPaymentType },
) {
  return apiClient.post(`/projects/${projectId}/works/${workId}/apply`, data).then((r) => r.data);
}

export function updateApplication(
  projectId: string,
  workId: string,
  data: { coverLetter?: string; offeredPrice?: number; preferredPayment?: WorkPaymentType },
) {
  return apiClient.patch(`/projects/${projectId}/works/${workId}/apply`, data).then((r) => r.data);
}

export function rejectApplication(projectId: string, workId: string, appId: string, reason?: string) {
  return apiClient
    .post(`/projects/${projectId}/works/${workId}/applications/${appId}/reject`, { reason })
    .then((r) => r.data);
}

export function fetchWorkApplications(projectId: string, workId: string) {
  return apiClient
    .get<WorkApplication[]>(`/projects/${projectId}/works/${workId}/applications`)
    .then((r) => r.data);
}

export function selectWorkApplicant(projectId: string, workId: string, appId: string) {
  return apiClient
    .post<ProjectWork>(`/projects/${projectId}/works/${workId}/applications/${appId}/select`)
    .then((r) => r.data);
}

export function submitWork(projectId: string, workId: string) {
  return apiClient.post<ProjectWork>(`/projects/${projectId}/works/${workId}/submit`).then((r) => r.data);
}

export function acceptWork(projectId: string, workId: string) {
  return apiClient.post<ProjectWork>(`/projects/${projectId}/works/${workId}/accept`).then((r) => r.data);
}

export function cancelWork(projectId: string, workId: string) {
  return apiClient.post<ProjectWork>(`/projects/${projectId}/works/${workId}/cancel`).then((r) => r.data);
}

export function disputeWork(projectId: string, workId: string) {
  return apiClient.post<ProjectWork>(`/projects/${projectId}/works/${workId}/dispute`).then((r) => r.data);
}

export function reviewWork(projectId: string, workId: string, rating: number, comment?: string) {
  return apiClient.post(`/projects/${projectId}/works/${workId}/review`, { rating, comment }).then((r) => r.data);
}

export function fetchWorkMilestones(projectId: string, workId: string) {
  return apiClient.get<WorkMilestone[]>(`/projects/${projectId}/works/${workId}/milestones`).then((r) => r.data);
}

export function addWorkMilestones(projectId: string, workId: string, items: Array<{ title: string; amount: number }>) {
  return apiClient.post(`/projects/${projectId}/works/${workId}/milestones`, { items }).then((r) => r.data);
}

export function submitMilestone(projectId: string, workId: string, milestoneId: string) {
  return apiClient
    .post(`/projects/${projectId}/works/${workId}/milestones/${milestoneId}/submit`)
    .then((r) => r.data);
}

export function acceptMilestone(projectId: string, workId: string, milestoneId: string) {
  return apiClient
    .post(`/projects/${projectId}/works/${workId}/milestones/${milestoneId}/accept`)
    .then((r) => r.data);
}

// --- Moderator ---

export function fetchDisputedWorks() {
  return apiClient.get<DisputedWork[]>('/works/disputed').then((r) => r.data);
}

export function resolveDispute(workId: string, releaseToWorker: boolean) {
  return apiClient.post(`/works/disputed/${workId}/resolve`, { releaseToWorker }).then((r) => r.data);
}

export function fetchMyWorks() {
  return apiClient.get<ProjectWork[]>('/works/mine').then((r) => r.data);
}

export function fetchUserWorks(userId: string) {
  return apiClient.get<UserWorks>(`/users/${userId}/works`).then((r) => r.data);
}
