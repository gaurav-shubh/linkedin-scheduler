// Original lines written for this app — deliberately not sourced from the book or
// other copyrighted collections. Each day deterministically gets one quote, chosen
// by where the user actually is: starting out, in momentum, coming back from a
// break, or closing out the evening.

export const QUOTES = {
  morning: [
    'Line up one domino. The rest of the day is just letting it fall.',
    'You don’t need a better plan. You need one clear first move.',
    'Big goals don’t need big days — they need one honest hour.',
    'Decide once, this morning, and the day stops negotiating with you.',
    'The list can wait. The ONE thing can’t.',
    'Clarity is a decision you make before breakfast.',
    'Small, chosen, done — beats big, vague, someday.',
    'Ask the question before the day asks its own.',
  ],
  momentum: [
    'Streaks aren’t luck. They’re the same small choice, re-chosen.',
    'You’ve already proven you can. Today is just more evidence.',
    'Momentum is quiet. Keep it that way — one more day.',
    'Every day you add a link, the chain argues louder than your doubts.',
    'Don’t break what’s working. One more domino.',
    'Consistency looks boring from the outside. It compounds anyway.',
  ],
  comeback: [
    'A missed day is a comma, not a full stop.',
    'You’re not starting over. You’re starting informed.',
    'The streak broke. The goal didn’t. Pick the next domino.',
    'Day one again? Fine. You’ve done day one before — faster this time.',
    'What matters isn’t the gap. It’s how quickly you return.',
  ],
  evening: [
    'Close the loop. Five seconds of honesty keeps tomorrow simple.',
    'However today went, name it — done or not. Then rest.',
    'The day is finished. Let the record say what actually happened.',
    'Tomorrow’s clarity starts with tonight’s honesty.',
  ],
};

/** Small deterministic hash so a given day always shows the same quote. */
export function hashKey(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Pick the category from where the user actually is:
 * evening (17:00+) > comeback (has history, streak broken) > momentum (streak >= 3) > morning.
 */
export function quoteCategory({ hour, streak, totalCompleted }) {
  if (hour >= 17) return 'evening';
  if (streak === 0 && totalCompleted > 0) return 'comeback';
  if (streak >= 3) return 'momentum';
  return 'morning';
}

export function quoteForDay(dateKeyStr, { hour = 8, streak = 0, totalCompleted = 0 } = {}) {
  const category = quoteCategory({ hour, streak, totalCompleted });
  const pool = QUOTES[category];
  const text = pool[hashKey(`${dateKeyStr}:${category}`) % pool.length];
  return { text, category };
}

export function greetingForHour(hour) {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
