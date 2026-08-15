// Pure streak arithmetic, kept out of the service so the day-stepping — which has
// to cross month and year boundaries correctly — can be tested on its own.

export function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The `count` days that ended before `today`, oldest first.
 *
 * What the draw's catch-up walks. Two things it must get right, which is why it is here
 * with the rest of the day arithmetic rather than inline in the service: today is never
 * in the list — a day still in progress must not be drawn, or it is settled against
 * whoever happened to be around before lunch — and the order is oldest to newest, so a
 * week of arrears is paid in the order it accrued.
 */
export function completedDaysBefore(today: Date, count: number): string[] {
  const days: string[] = [];
  for (let back = count; back >= 1; back -= 1) {
    // A fresh copy per step: `setDate` mutates, and stepping one cursor backwards would
    // also carry any month-end correction into the next iteration.
    const cursor = new Date(today.getTime());
    cursor.setDate(cursor.getDate() - back);
    days.push(ymd(cursor));
  }
  return days;
}

// The number of consecutive days ending on `today` that appear in `days`. Zero if
// today itself is missing, so a streak only counts while it is still alive.
export function countStreak(days: Set<string>, today: Date): number {
  let streak = 0;
  // Work on a copy so the caller's date isn't mutated as we step backwards.
  const cursor = new Date(today.getTime());
  for (;;) {
    if (!days.has(ymd(cursor))) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
