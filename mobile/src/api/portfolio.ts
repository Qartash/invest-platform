import { apiClient } from './client';
import { Portfolio } from '../types';

export function fetchPortfolio() {
  return apiClient.get<Portfolio>('/portfolio').then((r) => r.data);
}
