/**
 * Quote engine checks:
 *   node src/lib/__tests__/quotes.test.mjs
 */
import assert from 'node:assert/strict';
import { QUOTES, greetingForHour, quoteCategory, quoteForDay } from '../quotes.js';

let passed = 0;
function it(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

it('every category has quotes and none are blank', () => {
  for (const [category, pool] of Object.entries(QUOTES)) {
    assert.ok(pool.length >= 4, `${category} has only ${pool.length}`);
    for (const q of pool) {
      assert.ok(typeof q === 'string' && q.trim().length > 10, `bad quote in ${category}: "${q}"`);
    }
  }
});

it('the same day always shows the same quote', () => {
  const a = quoteForDay('2026-08-02', { hour: 8, streak: 0, totalCompleted: 0 });
  const b = quoteForDay('2026-08-02', { hour: 8, streak: 0, totalCompleted: 0 });
  assert.deepEqual(a, b);
});

it('quotes rotate across days rather than repeating one', () => {
  const seen = new Set();
  for (let d = 1; d <= 20; d += 1) {
    seen.add(quoteForDay(`2026-08-${String(d).padStart(2, '0')}`, { hour: 8 }).text);
  }
  assert.ok(seen.size >= 4, `only ${seen.size} distinct quotes over 20 days`);
});

it('category follows the user state, not just the clock', () => {
  assert.equal(quoteCategory({ hour: 8, streak: 0, totalCompleted: 0 }), 'morning', 'brand new user');
  assert.equal(quoteCategory({ hour: 8, streak: 5, totalCompleted: 5 }), 'momentum', 'active streak');
  assert.equal(quoteCategory({ hour: 8, streak: 0, totalCompleted: 12 }), 'comeback', 'broken streak with history');
  assert.equal(quoteCategory({ hour: 19, streak: 5, totalCompleted: 5 }), 'evening', 'evening wins over momentum');
});

it('a comeback day gets a comeback quote, not a cheery morning one', () => {
  const { category } = quoteForDay('2026-08-02', { hour: 8, streak: 0, totalCompleted: 30 });
  assert.equal(category, 'comeback');
});

it('greeting matches the hour', () => {
  assert.equal(greetingForHour(7), 'Good morning');
  assert.equal(greetingForHour(13), 'Good afternoon');
  assert.equal(greetingForHour(20), 'Good evening');
  assert.equal(greetingForHour(2), 'Still up');
});

console.log(`\n${passed} quote checks passed`);
