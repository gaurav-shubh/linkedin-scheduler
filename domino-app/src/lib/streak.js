import { addDays, dateKey } from './dates';

export const HABIT_CYCLE_DAYS = 66;

/**
 * entries: array of { date: 'YYYY-MM-DD', completed: 0|1 }, any order.
 * Streak counts consecutive completed days ending today or yesterday
 * (so the streak isn't broken just because today hasn't been marked yet).
 */
export function computeStreak(entries) {
  const completedDates = new Set(entries.filter((e) => e.completed).map((e) => e.date));
  let cursor = new Date();
  if (!completedDates.has(dateKey(cursor))) {
    cursor = addDays(cursor, -1);
  }
  let streak = 0;
  while (completedDates.has(dateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest run of consecutive completed days anywhere in the history. */
export function computeLongestStreak(entries) {
  const dates = entries
    .filter((e) => e.completed)
    .map((e) => e.date)
    .sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of dates) {
    if (d === prev) continue;
    run = prev && dateKey(addDays(parseKey(prev), 1)) === d ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Progress toward forming the habit, measured on the CURRENT streak — 66 consecutive
 * days, not a lifetime tally. `total` is reported separately as an all-time count so
 * the two can't be mistaken for one another.
 */
export function habitProgress(currentStreak, totalCompleted = 0) {
  return {
    dayInCycle: Math.min(currentStreak, HABIT_CYCLE_DAYS),
    cycleLength: HABIT_CYCLE_DAYS,
    total: totalCompleted,
    formed: currentStreak >= HABIT_CYCLE_DAYS,
  };
}
