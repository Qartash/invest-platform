import { apiClient } from './client';
import { ExpenseCategory, ProjectExpense, ProjectIncome, ProjectFinancialReport, ReportPayoutEntry } from '../types';

export function fetchProjectExpenses(projectId: string) {
  return apiClient.get<ProjectExpense[]>(`/projects/${projectId}/expenses`).then((r) => r.data);
}

export function addProjectExpense(
  projectId: string,
  data: { amount: number; category: ExpenseCategory; description: string; date: string },
) {
  return apiClient.post<ProjectExpense>(`/projects/${projectId}/expenses`, data).then((r) => r.data);
}

export function deleteProjectExpense(projectId: string, expenseId: string) {
  return apiClient.delete(`/projects/${projectId}/expenses/${expenseId}`).then((r) => r.data);
}

export function fetchProjectIncomes(projectId: string) {
  return apiClient.get<ProjectIncome[]>(`/projects/${projectId}/incomes`).then((r) => r.data);
}

export function addProjectIncome(projectId: string, data: { amount: number; description: string; date: string }) {
  return apiClient.post<ProjectIncome>(`/projects/${projectId}/incomes`, data).then((r) => r.data);
}

export function deleteProjectIncome(projectId: string, incomeId: string) {
  return apiClient.delete(`/projects/${projectId}/incomes/${incomeId}`).then((r) => r.data);
}

export function fetchProjectFinancialReports(projectId: string) {
  return apiClient.get<ProjectFinancialReport[]>(`/projects/${projectId}/financial-reports`).then((r) => r.data);
}

export function addProjectFinancialReport(projectId: string, data: { period: string }) {
  return apiClient.post<ProjectFinancialReport>(`/projects/${projectId}/financial-reports`, data).then((r) => r.data);
}

export function deleteProjectFinancialReport(projectId: string, reportId: string) {
  return apiClient.delete(`/projects/${projectId}/financial-reports/${reportId}`).then((r) => r.data);
}

export function payProjectFinancialReport(projectId: string, reportId: string) {
  return apiClient
    .post<ProjectFinancialReport>(`/projects/${projectId}/financial-reports/${reportId}/payout`)
    .then((r) => r.data);
}

export function fetchReportPayouts(projectId: string, reportId: string) {
  return apiClient
    .get<ReportPayoutEntry[]>(`/projects/${projectId}/financial-reports/${reportId}/payouts`)
    .then((r) => r.data);
}
