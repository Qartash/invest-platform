import { apiClient } from './client';
import { LogLevel, LogSettings, LogSource, SystemLog } from '../types';

export interface LogFilters {
  source?: LogSource;
  level?: LogLevel;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function sendClientLog(
  category: string,
  message: string,
  metadata?: Record<string, any>,
  level?: 'info' | 'warn' | 'error',
) {
  return apiClient.post('/logs/client', { category, message, level, metadata });
}

export function fetchLogs(filters: LogFilters) {
  return apiClient.get<{ items: SystemLog[]; total: number }>('/logs', { params: filters }).then((r) => r.data);
}

export function fetchLogSettings() {
  return apiClient.get<LogSettings>('/logs/settings').then((r) => r.data);
}

export function updateLogSettings(partial: Partial<LogSettings>) {
  return apiClient.patch<LogSettings>('/logs/settings', partial).then((r) => r.data);
}

export function clearLogs() {
  return apiClient.delete('/logs');
}
