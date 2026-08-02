/**
 * Plain-node checks for the date-sensitive logic (no test runner needed):
 *   node src/lib/__tests__/streak.test.mjs
 */
import assert from 'node:assert/strict';

const DAY = 86400000;
const HABIT_CYCLE_DAYS = 66;

// --- copies of the pure logic under test, kept in lockstep with src/lib ---
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };

function computeStreak(entries) {
  const done = new Set(entries.filter((e) => e.completed).map((e) => e.date));
  let cursor = new Date();
  if (!done.has(dateKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (done.has(dateKey(cursor))) { streak += 1; cursor = addDays(cursor, -1); }
  return streak;
}

function computeLongestStreak(entries) {
  const dates = entries.filter((e) => e.completed).map((e) => e.date).sort();
  let best = 0, run = 0, prev = null;
  for (const d of dates) {
    if (d === prev) continue;
    run = prev && dateKey(addDays(parseKey(prev), 1)) === d ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

function habitProgress(currentStreak, totalCompleted = 0) {
  return {
    dayInCycle: Math.min(currentStreak, HABIT_CYCLE_DAYS),
    cycleLength: HABIT_CYCLE_DAYS,
    total: totalCompleted,
    formed: currentStreak >= HABIT_CYCLE_DAYS,
  };
}

// Mirrors the guard in app/(tabs)/today.js
const needsYesterdayReview = (prev, reviewedUpTo, yesterdayKey) =>
  Boolean(prev && prev.one_thing && !prev.completed && reviewedUpTo !== yesterdayKey);

// --- fixtures ---
const today = new Date();
const day = (n) => dateKey(addDays(today, n));
const done = (n) => ({ date: day(n), completed: 1 });
const missed = (n) => ({ date: day(n), completed: 0 });

let passed = 0;
function it(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

it('streak counts back from today', () => {
  assert.equal(computeStreak([done(0), done(-1), done(-2)]), 3);
});

it('unmarked today does not break an active streak', () => {
  assert.equal(computeStreak([done(-1), done(-2)]), 2);
});

it('a real gap breaks the streak', () => {
  assert.equal(computeStreak([done(-1), missed(-2), done(-3)]), 1);
});

it('no completions means no streak', () => {
  assert.equal(computeStreak([missed(0), missed(-1)]), 0);
});

it('repairing a missed day rejoins the streak (the History fix)', () => {
  const broken = [done(0), done(-1), missed(-2), done(-3), done(-4)];
  assert.equal(computeStreak(broken), 2);
  const repaired = broken.map((e) => (e.date === day(-2) ? { ...e, completed: 1 } : e));
  assert.equal(computeStreak(repaired), 5, 'toggling the missed day should restore the full run');
});

it('longest streak survives a later break', () => {
  assert.equal(computeLongestStreak([done(-10), done(-9), done(-8), missed(-7), done(-6)]), 3);
});

it('longest streak handles empty and single-day input', () => {
  assert.equal(computeLongestStreak([]), 0);
  assert.equal(computeLongestStreak([done(-1)]), 1);
});

it('habit progress follows the CURRENT streak, not a lifetime tally', () => {
  // The old bug: 200 lifetime completions with a broken streak reported deep habit progress.
  const p = habitProgress(3, 200);
  assert.equal(p.dayInCycle, 3, 'should reflect the 3-day streak, not the 200 total');
  assert.equal(p.total, 200);
  assert.equal(p.formed, false);
});

it('habit progress caps at the cycle length and reports formed', () => {
  const p = habitProgress(80, 80);
  assert.equal(p.dayInCycle, 66);
  assert.equal(p.formed, true);
});

it('yesterday review shows only for a planned, unmarked, unreviewed day', () => {
  const yk = day(-1);
  assert.equal(needsYesterdayReview({ one_thing: 'x', completed: 0 }, null, yk), true);
  assert.equal(needsYesterdayReview({ one_thing: 'x', completed: 1 }, null, yk), false, 'already done');
  assert.equal(needsYesterdayReview({ one_thing: '', completed: 0 }, null, yk), false, 'never planned');
  assert.equal(needsYesterdayReview({ one_thing: 'x', completed: 0 }, yk, yk), false, 'already answered');
  assert.equal(needsYesterdayReview(null, null, yk), false, 'no entry at all');
});

console.log(`\n${passed} unit checks passed`);
