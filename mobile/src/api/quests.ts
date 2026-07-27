import { apiClient } from './client';
import { LocalizedText } from '../types';

export type QuestScope = 'platform' | 'project';
export type QuestVerification = 'auto' | 'client' | 'admin';

export interface Quest {
  id: string;
  // Built-in platform quests carry a key the app translates; project quests
  // carry the founder's own wording in `title`/`description` instead.
  key: string | null;
  scope: QuestScope;
  verification: QuestVerification;
  title: string | null;
  description: string | null;
  videoUrl: string | null;
  reward: number;
  projectId: string | null;
  projectTitle: LocalizedText | null;
  completed: boolean;
  completedAmount: number;
  // For auto-checked quests: whether the condition is already satisfied.
  eligible: boolean;
}

export function fetchQuests() {
  return apiClient.get<Quest[]>('/quests').then((r) => r.data);
}

export function completeQuest(id: string) {
  return apiClient.post<{ questId: string; awarded: number }>(`/quests/${id}/complete`).then((r) => r.data);
}

export interface DailyBonus {
  pool: number;
  share: number;
  wonToday: number;
  organicArrivals: number;
}

export function fetchDailyBonus() {
  return apiClient.get<DailyBonus>('/activity/daily-bonus').then((r) => r.data);
}
