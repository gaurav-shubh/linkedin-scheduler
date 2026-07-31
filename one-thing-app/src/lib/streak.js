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

export function habitProgress(totalCompletedCount) {
  if (totalCompletedCount <= 0) {
    return { cycle: 1, dayInCycle: 0, total: 0, cycleLength: HABIT_CYCLE_DAYS };
  }
  const cycle = Math.floor((totalCompletedCount - 1) / HABIT_CYCLE_DAYS) + 1;
  const dayInCycle = ((totalCompletedCount - 1) % HABIT_CYCLE_DAYS) + 1;
  return { cycle, dayInCycle, total: totalCompletedCount, cycleLength: HABIT_CYCLE_DAYS };
}
