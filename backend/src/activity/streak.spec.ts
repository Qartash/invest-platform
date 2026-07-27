import { countStreak, ymd } from './streak';

// Builds the set of check-in days as the last `n` consecutive days ending on `end`.
const consecutive = (end: Date, n: number): Set<string> => {
  const days = new Set<string>();
  const cursor = new Date(end.getTime());
  for (let i = 0; i < n; i += 1) {
    days.add(ymd(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return days;
};

describe('countStreak', () => {
  it('is zero when today has no check-in', () => {
    const today = new Date('2026-07-26T09:00:00Z');
    const days = consecutive(new Date('2026-07-25T09:00:00Z'), 5); // ends yesterday
    expect(countStreak(days, today)).toBe(0);
  });

  it('counts an unbroken run ending today', () => {
    const today = new Date('2026-07-26T09:00:00Z');
    expect(countStreak(consecutive(today, 7), today)).toBe(7);
  });

  it('stops at the first gap', () => {
    const today = new Date('2026-07-26T09:00:00Z');
    const days = consecutive(today, 3); // 24, 25, 26
    days.add('2026-07-20'); // an older island that must not extend the count
    expect(countStreak(days, today)).toBe(3);
  });

  // The day-stepping walks backwards with setDate, which must roll over correctly.
  it('crosses a month boundary', () => {
    const today = new Date('2026-08-02T09:00:00Z');
    // Aug 2,1 + Jul 31,30 — four in a row across the month end.
    const days = new Set(['2026-08-02', '2026-08-01', '2026-07-31', '2026-07-30']);
    expect(countStreak(days, today)).toBe(4);
  });

  it('crosses a year boundary', () => {
    const today = new Date('2027-01-01T09:00:00Z');
    const days = new Set(['2027-01-01', '2026-12-31', '2026-12-30']);
    expect(countStreak(days, today)).toBe(3);
  });

  it('does not mutate the date it is handed', () => {
    const today = new Date('2026-07-26T09:00:00Z');
    countStreak(consecutive(today, 4), today);
    expect(ymd(today)).toBe('2026-07-26');
  });
});
