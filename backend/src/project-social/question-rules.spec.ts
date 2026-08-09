import { ProjectStatus } from '../common/enums';
import {
  MAX_QUESTIONS_PER_DAY,
  MAX_QUESTIONS_PER_PROJECT_PER_DAY,
  acceptsQuestions,
  canAmendQuestion,
  canAsk,
  isFounderAnswer,
  questionAllowance,
} from './question-rules';

describe('acceptsQuestions', () => {
  it('is open on a live project', () => {
    expect(acceptsQuestions({ status: ProjectStatus.ACTIVE })).toBe(true);
  });

  // The status people most need to be able to ask about: the money is in.
  it('stays open after the project is funded', () => {
    expect(acceptsQuestions({ status: ProjectStatus.FUNDED })).toBe(true);
  });

  it('is closed before the project is public', () => {
    expect(acceptsQuestions({ status: ProjectStatus.DRAFT })).toBe(false);
    expect(acceptsQuestions({ status: ProjectStatus.PENDING_REVIEW })).toBe(false);
  });

  it('is closed on a finished or rejected project', () => {
    expect(acceptsQuestions({ status: ProjectStatus.CLOSED })).toBe(false);
    expect(acceptsQuestions({ status: ProjectStatus.REJECTED })).toBe(false);
  });

  it('is closed on a deleted project whatever its status still says', () => {
    expect(acceptsQuestions({ status: ProjectStatus.ACTIVE, deletedAt: new Date() })).toBe(false);
  });
});

describe('canAsk', () => {
  const project = { founderId: 'founder', status: ProjectStatus.ACTIVE };

  it('lets an investor ask', () => {
    expect(canAsk(project, 'investor')).toBe(true);
  });

  // Otherwise a founder can manufacture an FAQ that reads as if investors wrote it.
  it('refuses the founder asking their own project', () => {
    expect(canAsk(project, 'founder')).toBe(false);
  });
});

describe('isFounderAnswer', () => {
  it('is an answer from the founder and a follow-up from anyone else', () => {
    expect(isFounderAnswer({ founderId: 'founder' }, 'founder')).toBe(true);
    expect(isFounderAnswer({ founderId: 'founder' }, 'friend')).toBe(false);
  });
});

describe('canAmendQuestion', () => {
  const base = { authorId: 'asker', replyCount: 0 };

  it('lets the author fix their own unanswered question', () => {
    expect(canAmendQuestion(base, 'asker')).toBe(true);
  });

  it('refuses somebody else', () => {
    expect(canAmendQuestion(base, 'stranger')).toBe(false);
  });

  // The rule that keeps a thread honest: an answer is an answer to particular
  // words, and those words stop being editable the moment one exists.
  it('refuses once anybody has replied', () => {
    expect(canAmendQuestion({ ...base, replyCount: 1 }, 'asker')).toBe(false);
  });

  it('refuses a hidden question', () => {
    expect(canAmendQuestion({ ...base, hiddenAt: new Date() }, 'asker')).toBe(false);
  });

  it('refuses a question whose author is gone', () => {
    expect(canAmendQuestion({ ...base, authorId: null }, 'asker')).toBe(false);
  });
});

describe('questionAllowance', () => {
  it('allows a question under both ceilings', () => {
    expect(questionAllowance({ onThisProject: 1, today: 4 })).toEqual({ allowed: true });
  });

  it('stops at the per-project ceiling first', () => {
    expect(
      questionAllowance({ onThisProject: MAX_QUESTIONS_PER_PROJECT_PER_DAY, today: 3 }),
    ).toEqual({ allowed: false, limit: 'project' });
  });

  it('stops at the daily ceiling across projects', () => {
    expect(questionAllowance({ onThisProject: 0, today: MAX_QUESTIONS_PER_DAY })).toEqual({
      allowed: false,
      limit: 'daily',
    });
  });

  // Spreading the same flood over ten projects is still a flood.
  it('is not escaped by moving to another project', () => {
    expect(questionAllowance({ onThisProject: 0, today: MAX_QUESTIONS_PER_DAY + 5 }).allowed).toBe(
      false,
    );
  });
});
