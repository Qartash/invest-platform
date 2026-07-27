import { apiClient } from './client';

export interface StreakState {
  streak: number;
  target: number;
  // Present on check-in: how much the weekly reward paid (0 if none today), and
  // whether this check-in qualified the user's referral chain.
  rewardedToday?: number;
  qualifiedChain?: boolean;
}

// Called on app launch/foreground. Records today and returns the streak, paying
// the weekly reward and qualifying the referral chain when a week completes.
export function checkIn() {
  return apiClient.post<StreakState>('/activity/checkin').then((r) => r.data);
}

export function fetchStreak() {
  return apiClient.get<StreakState>('/activity/streak').then((r) => r.data);
}
