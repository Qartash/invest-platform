import {
  ANSWER_WINDOW_HOURS,
  GOOD_MEDIAN_MINUTES,
  SLOW_MEDIAN_MINUTES,
  describeResponsiveness,
  isOverdue,
  minutesLeftToAnswer,
} from './responsiveness';

describe('describeResponsiveness', () => {
  it('says nothing about a project nobody has asked', () => {
    const badge = describeResponsiveness({
      questionsCount: 0,
      questionsAnsweredCount: 0,
      answerMedianMinutes: null,
    });
    expect(badge.tier).toBe('none');
    expect(badge.answeredRatio).toBeNull();
  });

  // The rule that makes the badge worth anything: silence is never credit. A
  // founder who has never been asked is not a founder who answers.
  it('does not treat an unasked project as a good one', () => {
    expect(
      describeResponsiveness({
        questionsCount: 0,
        questionsAnsweredCount: 0,
        answerMedianMinutes: null,
      }).tier,
    ).not.toBe('good');
  });

  it('is good when nearly everything is answered, quickly', () => {
    expect(
      describeResponsiveness({
        questionsCount: 15,
        questionsAnsweredCount: 14,
        answerMedianMinutes: 240,
      }).tier,
    ).toBe('good');
  });

  it('is poor when questions were asked and none were answered', () => {
    const badge = describeResponsiveness({
      questionsCount: 6,
      questionsAnsweredCount: 0,
      answerMedianMinutes: null,
    });
    expect(badge.tier).toBe('poor');
    expect(badge.unansweredCount).toBe(6);
  });

  it('is poor when most questions go unanswered, however fast the rest were', () => {
    expect(
      describeResponsiveness({
        questionsCount: 10,
        questionsAnsweredCount: 3,
        answerMedianMinutes: 5,
      }).tier,
    ).toBe('poor');
  });

  it('is slow when everything is answered but it takes days', () => {
    expect(
      describeResponsiveness({
        questionsCount: 10,
        questionsAnsweredCount: 10,
        answerMedianMinutes: GOOD_MEDIAN_MINUTES + 60,
      }).tier,
    ).toBe('slow');
  });

  it('falls to poor once the median passes the slow threshold', () => {
    expect(
      describeResponsiveness({
        questionsCount: 10,
        questionsAnsweredCount: 10,
        answerMedianMinutes: SLOW_MEDIAN_MINUTES + 1,
      }).tier,
    ).toBe('poor');
  });

  // Counters are written by two different paths (an answer landing, a question
  // being hidden), so the display must not fall apart if they ever disagree.
  it('never reports more answered than asked, or a negative backlog', () => {
    const badge = describeResponsiveness({
      questionsCount: 3,
      questionsAnsweredCount: 9,
      answerMedianMinutes: 10,
    });
    expect(badge.answeredCount).toBe(3);
    expect(badge.unansweredCount).toBe(0);
    expect(badge.answeredRatio).toBe(1);
  });
});

describe('the answering window', () => {
  const asked = new Date('2026-08-01T09:00:00Z');

  it('is not overdue inside the window', () => {
    const now = new Date(asked.getTime() + (ANSWER_WINDOW_HOURS - 1) * 3600_000);
    expect(isOverdue(asked, now)).toBe(false);
    expect(minutesLeftToAnswer(asked, now)).toBe(60);
  });

  it('is overdue past it', () => {
    const now = new Date(asked.getTime() + (ANSWER_WINDOW_HOURS + 2) * 3600_000);
    expect(isOverdue(asked, now)).toBe(true);
    expect(minutesLeftToAnswer(asked, now)).toBe(-120);
  });
});
