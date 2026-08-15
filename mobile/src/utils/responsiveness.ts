/**
 * How this founder treats the people who asked, as one badge.
 *
 * A deliberate port of `backend/src/project-social/responsiveness.ts` rather
 * than a fetch: the three raw numbers already come down on every project, and
 * the app has to be able to draw the badge in a list of twenty cards without
 * asking the server what each one means. The thresholds are duplicated, so the
 * two files name each other — change one and change the other.
 */

export const GOOD_MEDIAN_MINUTES = 24 * 60;
export const SLOW_MEDIAN_MINUTES = 3 * 24 * 60;
export const GOOD_ANSWERED_RATIO = 0.8;
export const POOR_ANSWERED_RATIO = 0.5;
export const ANSWER_WINDOW_HOURS = 48;

export type ResponsivenessTier = 'none' | 'good' | 'slow' | 'poor';

export interface ResponsivenessInput {
  questionsCount?: number | null;
  questionsAnsweredCount?: number | null;
  answerMedianMinutes?: number | null;
}

export interface Responsiveness {
  tier: ResponsivenessTier;
  questionsCount: number;
  answeredCount: number;
  unansweredCount: number;
  answeredRatio: number | null;
  medianMinutes: number | null;
}

export function describeResponsiveness(project: ResponsivenessInput): Responsiveness {
  const questionsCount = Math.max(0, project.questionsCount ?? 0);
  const answeredCount = Math.min(questionsCount, Math.max(0, project.questionsAnsweredCount ?? 0));
  const unansweredCount = questionsCount - answeredCount;
  const medianMinutes = project.answerMedianMinutes ?? null;

  // Never asked is not the same as answers everything — a founder gets credit
  // for answering, not for silence.
  if (questionsCount === 0) {
    return {
      tier: 'none',
      questionsCount: 0,
      answeredCount: 0,
      unansweredCount: 0,
      answeredRatio: null,
      medianMinutes: null,
    };
  }

  const answeredRatio = answeredCount / questionsCount;
  const base = { questionsCount, answeredCount, unansweredCount, answeredRatio, medianMinutes };

  if (answeredCount === 0 || answeredRatio < POOR_ANSWERED_RATIO) return { ...base, tier: 'poor' };
  if (answeredRatio >= GOOD_ANSWERED_RATIO && (medianMinutes ?? Infinity) <= GOOD_MEDIAN_MINUTES) {
    return { ...base, tier: 'good' };
  }
  if ((medianMinutes ?? Infinity) > SLOW_MEDIAN_MINUTES) return { ...base, tier: 'poor' };
  return { ...base, tier: 'slow' };
}

/** Minutes left before a question counts as ignored; negative once it has passed. */
export function minutesLeftToAnswer(askedAt: string | Date, now: Date = new Date()): number {
  const asked = typeof askedAt === 'string' ? new Date(askedAt) : askedAt;
  return Math.round((asked.getTime() + ANSWER_WINDOW_HOURS * 3600_000 - now.getTime()) / 60000);
}
