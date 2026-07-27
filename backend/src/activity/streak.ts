// Pure streak arithmetic, kept out of the service so the day-stepping — which has
// to cross month and year boundaries correctly — can be tested on its own.

export function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
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
