/**
 * The badge on a project card: how this founder treats the people who asked.
 *
 * This is the whole point of the questions feature. Not the threads themselves —
 * the fact that a reader sees "does not answer · 6 questions" next to the risk
 * level and the amount raised, before they have put any money in. Everything
 * else here exists to produce these four fields honestly.
 *
 * Kept as a pure function over the three numbers stored on the project so the
 * backend and the app agree on what counts as good, and so the thresholds can be
 * argued about in one place instead of being spread across two codebases.
 */

/** Answers faster than this, with most questions answered, reads as good. */
export const GOOD_MEDIAN_MINUTES = 24 * 60;
/** Past this, the median is reported in days and the badge turns amber. */
export const SLOW_MEDIAN_MINUTES = 3 * 24 * 60;
/** Below this share answered, nothing else redeems the badge. */
export const GOOD_ANSWERED_RATIO = 0.8;
export const POOR_ANSWERED_RATIO = 0.5;
/**
 * How long a founder has before a question counts as ignored. Nothing is
 * enforced and nothing is charged — it moves these figures, which investors see.
 */
export const ANSWER_WINDOW_HOURS = 48;

export type ResponsivenessTier = 'none' | 'good' | 'slow' | 'poor';

export interface ResponsivenessInput {
  questionsCount: number;
  questionsAnsweredCount: number;
  answerMedianMinutes: number | null;
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
  const medianMinutes = project.answerMedianMinutes;

  // Nobody has asked anything. Deliberately not "good": a founder gets credit
  // for answering, never for not having been asked.
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

  // Asked and never answered once. The worst case and the most common one worth
  // warning about, and it is reachable with a null median — which is why the
  // ratio is checked before the clock.
  if (answeredCount === 0 || answeredRatio < POOR_ANSWERED_RATIO) {
    return { ...base, tier: 'poor' };
  }

  if (answeredRatio >= GOOD_ANSWERED_RATIO && (medianMinutes ?? Infinity) <= GOOD_MEDIAN_MINUTES) {
    return { ...base, tier: 'good' };
  }

  if ((medianMinutes ?? Infinity) > SLOW_MEDIAN_MINUTES) {
    return { ...base, tier: 'poor' };
  }

  return { ...base, tier: 'slow' };
}

/**
 * Whether a question has been sitting past the answering window. Used for the
 * founder's queue — the app draws the countdown, this decides when it has run
 * out — and for the daily nudge.
 */
export function isOverdue(askedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - askedAt.getTime() > ANSWER_WINDOW_HOURS * 60 * 60 * 1000;
}

/** Minutes left in the window; negative once it has passed. */
export function minutesLeftToAnswer(askedAt: Date, now: Date = new Date()): number {
  const deadline = askedAt.getTime() + ANSWER_WINDOW_HOURS * 60 * 60 * 1000;
  return Math.round((deadline - now.getTime()) / 60000);
}
