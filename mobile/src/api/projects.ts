import { Platform } from 'react-native';
import { apiClient } from './client';
import {
  BudgetItemStatus,
  Project,
  ProjectAttachment,
  ProjectBudgetItem,
  ProjectPurchase,
  ProjectReviewLogEntry,
  TicketListing,
} from '../types';

export function fetchProjects(status: 'active' | 'funded' = 'active') {
  return apiClient.get<Project[]>('/projects', { params: { status } }).then((r) => r.data);
}

export function fetchProject(id: string) {
  return apiClient.get<Project>(`/projects/${id}`).then((r) => r.data);
}

export function fetchProjectPurchases(id: string) {
  return apiClient.get<ProjectPurchase[]>(`/projects/${id}/purchases`).then((r) => r.data);
}

export function fetchProjectListings(id: string) {
  return apiClient.get<TicketListing[]>(`/projects/${id}/listings`).then((r) => r.data);
}

export function fetchProjectHistory(id: string) {
  return apiClient.get<ProjectReviewLogEntry[]>(`/projects/${id}/history`).then((r) => r.data);
}

export function fetchMyProjects() {
  return apiClient.get<Project[]>('/projects/mine').then((r) => r.data);
}

export function fetchPendingProjects() {
  return apiClient.get<Project[]>('/projects/pending').then((r) => r.data);
}

export function approveProject(id: string, comment: string) {
  return apiClient.patch<Project>(`/projects/${id}/approve`, { comment }).then((r) => r.data);
}

export function rejectProject(id: string, comment: string) {
  return apiClient.patch<Project>(`/projects/${id}/reject`, { comment }).then((r) => r.data);
}

export function setProjectRisk(id: string, riskLevel: string, reason: string) {
  return apiClient.patch<Project>(`/projects/${id}/risk`, { riskLevel, reason }).then((r) => r.data);
}

export function setProjectPriority(id: string, priority: string) {
  return apiClient.patch<Project>(`/projects/${id}/priority`, { priority }).then((r) => r.data);
}

export function cancelProjectReview(id: string) {
  return apiClient.patch<Project>(`/projects/${id}/cancel-review`).then((r) => r.data);
}

export function requestProjectDeletion(id: string) {
  return apiClient.patch<Project>(`/projects/${id}/request-deletion`).then((r) => r.data);
}

export function cancelProjectDeletion(id: string) {
  return apiClient.patch<Project>(`/projects/${id}/cancel-deletion`).then((r) => r.data);
}

export function restoreProject(id: string) {
  return apiClient.patch<Project>(`/projects/${id}/restore`).then((r) => r.data);
}

export function fetchPendingDeletions() {
  return apiClient.get<Project[]>('/projects/pending-deletions').then((r) => r.data);
}

export function approveProjectDeletion(id: string) {
  return apiClient.patch<Project>(`/projects/${id}/approve-deletion`).then((r) => r.data);
}

export function rejectProjectDeletion(id: string, comment: string) {
  return apiClient.patch<Project>(`/projects/${id}/reject-deletion`, { comment }).then((r) => r.data);
}

interface ProjectFormData {
  title: Record<string, string>;
  description: Record<string, string>;
  targetAmount: number;
  ticketPrice: number;
  totalTickets: number;
  category?: string;
  riskLevel?: string;
  priority?: string;
  deadline?: string;
  priceTierCount?: number;
  priceTierIncrementPercent?: number;
  youtubeUrl?: string;
  resaleEnabled?: boolean;
  expectedAnnualReturnPercent?: number;
  payoutStartDays?: number;
  changeReason?: string;
  budgetItems?: { title: string; amount: number }[];
}

export function createProject(data: ProjectFormData) {
  return apiClient.post<Project>('/projects', data).then((r) => r.data);
}

export function updateProject(id: string, data: Partial<ProjectFormData>) {
  return apiClient.patch<Project>(`/projects/${id}`, data).then((r) => r.data);
}

export async function uploadCoverImage(id: string, file: { uri: string; name: string; type: string }) {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const blob = await fetch(file.uri).then((r) => r.blob());
    formData.append('file', blob, file.name);
  } else {
    formData.append('file', file as unknown as Blob);
  }
  return apiClient
    .post<Project>(`/projects/${id}/cover-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
}

export function fetchProjectAttachments(id: string) {
  return apiClient.get<ProjectAttachment[]>(`/projects/${id}/attachments`).then((r) => r.data);
}

export function uploadProjectAttachment(id: string, file: File) {
  const formData = new FormData();
  formData.append('file', file, file.name);
  return apiClient
    .post<ProjectAttachment>(`/projects/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
}

export function deleteProjectAttachment(id: string, attachmentId: string) {
  return apiClient.delete(`/projects/${id}/attachments/${attachmentId}`).then((r) => r.data);
}

export function fetchProjectBudgetItems(id: string) {
  return apiClient.get<ProjectBudgetItem[]>(`/projects/${id}/budget-items`).then((r) => r.data);
}

export function addProjectBudgetItems(id: string, items: { title: string; amount: number }[]) {
  return apiClient.post<ProjectBudgetItem[]>(`/projects/${id}/budget-items`, { items }).then((r) => r.data);
}

export function updateProjectBudgetItemStatus(id: string, itemId: string, status: BudgetItemStatus) {
  return apiClient
    .patch<ProjectBudgetItem>(`/projects/${id}/budget-items/${itemId}/status`, { status })
    .then((r) => r.data);
}
