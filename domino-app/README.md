# Domino — daily focus tracker

Named for the Domino Effect: one right thing knocks down the next.

A mobile app based on *The ONE Thing* by Gary Keller & Jay Papasan. Every morning it asks
the book's Focusing Question and helps you keep your daily, weekly, monthly, one-year and
someday goals lined up on one staircase — then tracks whether you actually did your ONE
Thing each day. An optional "Your Why" anchor (inspired by Simon Sinek's *Start With Why*)
sits above the staircase so every answer stays tied to a purpose.

## What it does

- **Onboarding**: a short explainer of the ideas, then captures your optional Why plus your
  Someday Goal, Five-Year Goal and One-Year Goal, and your preferred morning notification
  time.
- **Today tab**: shows the why/year/month/week context above the question, asks *"Based on
  this week's ONE thing, what's the ONE thing you can do today?"*, lets you note a time
  block for it, and mark it done. Shows your current streak and progress through a 66-day
  habit cycle.
- **Week & Month tab**: same staircase logic for the current week and month, plus a history
  of past weeks/months.
- **Goals tab**: edit your Why and your Someday / Five-Year / One-Year goals, plus a
  reminder of the book's "Four Thieves of Focus".
- **History tab**: a 12-week completion heatmap, longest streak, and recent daily entries.
  **Tap any day to correct it** — forgetting to mark something done shouldn't cost a streak
  you actually earned.
- **Settings**: notification times and toggles, **data export**, or reset all data.

### Time blocking

Picking a time block schedules a reminder for it. Earlier this was a free-text note that
looked like a commitment but did nothing. Your choice carries over to seed the next day,
since the book argues for the same block every day.

### Export

Everything lives on this device only, so losing the phone would otherwise lose your
history. Settings exports either a full **JSON backup** (goals, periods, entries,
settings) or a **CSV of daily entries** for a spreadsheet. On a phone this opens the share
sheet; in a browser it downloads.

### The open-the-app moment

Today greets you by time of day with one quote chosen for where you actually are —
starting out, in momentum, coming back from a missed day, or closing out the evening —
and anchors it to *your own* Why, so the reason you started using the app is the first
thing you see. Quotes are original to the app and deterministic per day (the same day
always shows the same line). The UI is set in Fraunces on a warm cream/ink-green palette.

### Staying on track

The app is built around the assumption that people forget, and that a system which
punishes forgetting gets deleted:

- **Missing rung prompts.** The daily question only makes sense if there's a weekly one
  above it. If the month or week ONE Thing isn't set, Today prompts for it inline (and
  softens the daily question rather than referring to something that doesn't exist).
- **Morning prompt** (default 7:00 AM) — the Focusing Question, opens straight to Today.
- **Evening check-in** (default 9:00 PM) — a nudge to mark the day done, so a day you
  actually did doesn't get recorded as a miss.
- **Yesterday review** — if yesterday was planned but never marked, Today asks once
  whether you did it. Answering either way retires the question.
- **Week and month kickoff** — Monday and the 1st, a reminder to set the bigger ONE Thing.
- **66-day progress tracks your current streak**, not a lifetime tally, and the all-time
  count is shown separately so the two can't be confused.

All data is stored on-device only (SQLite via `expo-sqlite`) — no account, no server, no
network calls.

## Running it

```bash
cd domino-app
npm install
npx expo start
```

- Scan the QR code with the **Expo Go** app on your phone (iOS or Android) — no build step
  needed for local notifications, they work in Expo Go.

Run the logic tests (streaks, habit progress, review rules) with:

```bash
npm test
```

- Or press `w` in the terminal / run `npm run web` to preview in a browser (SQLite web
  support is alpha; local notifications aren't testable in a browser — use Expo Go or a
  device build for that).

### Building a real installable app

Expo Go is great for day-to-day use, but for a standalone app icon on your home screen
(and to survive Expo Go account/session changes), build with EAS:

```bash
npm install -g eas-cli
eas login
eas build --profile preview --platform android   # or ios
```

That produces an installable `.apk`/`.aab` (Android) or needs an Apple developer account
for iOS. See https://docs.expo.dev/build/introduction/ for the full setup — no code changes
in this repo are required.

## Project layout

```
app/                  expo-router screens
  _layout.js           SQLite provider + notification tap → Today routing
  index.js             redirects to onboarding or the tabs
  onboarding.js        first-launch wizard
  (tabs)/              Today · Week & Month · Goals · History · Settings
src/
  db/                  SQLite schema + query helpers
  lib/                 date/week/month key math, streak & habit-cycle math,
                        notification scheduling, the framework copy (prompts,
                        Four Thieves, Why)
  components/          shared UI (prompt editor, streak badges, heatmap, ...)
```

## Notes

- Notifications are local-only (no push server, no account) — SDK 57's Expo Go build
  supports local notifications on both platforms; only remote push is restricted.
- The 66-day counter and streak are derived from your daily "done" marks — there's no
  separate habit-tracker screen to keep in sync.
