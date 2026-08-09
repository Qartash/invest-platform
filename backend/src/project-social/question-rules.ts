import { ProjectStatus } from '../common/enums';

/**
 * Who may write what, and when. Pulled out of the service so the rules can be
 * read in one place and tested without a database — these are the parts that are
 * easy to get subtly wrong and expensive to get wrong in public.
 */

export const MAX_QUESTIONS_PER_PROJECT_PER_DAY = 3;
export const MAX_QUESTIONS_PER_DAY = 10;

/**
 * Where questions may be asked.
 *
 * A draft or a project still in review has no audience and no investors yet. A
 * closed or rejected one keeps everything already written readable — it is the
 * project's history, and hiding it after the fact would be the platform editing
 * its own record — but takes nothing new.
 *
 * FUNDED is in the list on purpose. A project that has taken the money is
 * exactly the one people most need to be able to ask about, and leaving it out
 * would close the questions the moment they start mattering.
 */
export const OPEN_TO_QUESTIONS: ProjectStatus[] = [ProjectStatus.ACTIVE, ProjectStatus.FUNDED];

export function acceptsQuestions(project: { status: ProjectStatus; deletedAt?: Date | null }): boolean {
  if (project.deletedAt) return false;
  return OPEN_TO_QUESTIONS.includes(project.status);
}

/**
 * A question can be taken back or reworded only while nobody has replied to it.
 * After that the words are what an answer was given to, and changing them
 * rewrites what the founder was responding to.
 */
export function canAmendQuestion(question: {
  authorId: string | null;
  hiddenAt?: Date | null;
  replyCount: number;
}, userId: string): boolean {
  if (!question.authorId || question.authorId !== userId) return false;
  if (question.hiddenAt) return false;
  return question.replyCount === 0;
}

/**
 * Only the founder answers; anyone may add a follow-up. Both land in the same
 * table — this is what decides which of the two a given reply is, and therefore
 * whether it moves the project's responsiveness figures.
 *
 * A friend of the founder replying must never count as an answer, or a founder
 * could clear their own queue by proxy.
 */
export function isFounderAnswer(project: { founderId: string }, userId: string): boolean {
  return project.founderId === userId;
}

/**
 * A founder asking their own project a question is talking to themselves in
 * public, and the only use for it is manufacturing an FAQ that looks like it
 * came from investors.
 */
export function canAsk(project: { founderId: string; status: ProjectStatus; deletedAt?: Date | null }, userId: string): boolean {
  if (!acceptsQuestions(project)) return false;
  return project.founderId !== userId;
}

export interface DailyUsage {
  onThisProject: number;
  today: number;
}

/**
 * Whether one more question is allowed right now, and which ceiling stopped it.
 * Not security — the invite gate already means every account is a real person —
 * but a brake on the one pattern that makes founders stop answering entirely:
 * twenty variations of the same question in one evening.
 */
export function questionAllowance(usage: DailyUsage): { allowed: boolean; limit?: 'project' | 'daily' } {
  if (usage.onThisProject >= MAX_QUESTIONS_PER_PROJECT_PER_DAY) {
    return { allowed: false, limit: 'project' };
  }
  if (usage.today >= MAX_QUESTIONS_PER_DAY) {
    return { allowed: false, limit: 'daily' };
  }
  return { allowed: true };
}
