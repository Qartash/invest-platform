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

/** One day of the draw. Past days are described by what was paid, not by the pot. */
export interface DailyDrawDay {
  date: string;
  /** People who registered that day with nobody's code — what funds the pot. */
  organicArrivals: number;
  pool: number;
  /** How many winners the pot can pay. Against `participants` it is the odds. */
  seats: number;
  participants: number;
  winners: number;
  /** Whether the draw has already run for this day. */
  drawn: boolean;
  youWon: number;
  youIn: boolean;
}

export interface DailyBonus {
  share: number;
  /** What the platform puts up per code-less arrival — the rate the card explains. */
  perArrival: number;
  today: DailyDrawDay;
  yesterday: DailyDrawDay;
}

export function fetchDailyBonus() {
  return apiClient.get<DailyBonus>('/activity/daily-bonus').then((r) => r.data);
}
