# The ONE Thing — daily tracker

A mobile app based on *The ONE Thing* by Gary Keller & Jay Papasan. Every morning it asks
the book's Focusing Question and helps you keep your daily, weekly, monthly, one-year and
someday goals lined up on one staircase — then tracks whether you actually did your ONE
Thing each day.

## What it does

- **Onboarding**: a short explainer of the book's ideas, then sets your Someday Goal,
  Five-Year Goal and One-Year Goal, and your preferred morning notification time.
- **Today tab**: shows the week/month/year context above the question, asks *"Based on
  this week's ONE thing, what's the ONE thing you can do today?"*, lets you note a time
  block for it, and mark it done. Shows your current streak and progress through a 66-day
  habit cycle.
- **Week & Month tab**: same staircase logic for the current week and month, plus a history
  of past weeks/months.
- **Goals tab**: edit your Someday / Five-Year / One-Year goals, plus a reminder of the
  book's "Four Thieves of Focus".
- **History tab**: a 12-week completion heatmap and a list of recent daily entries.
- **Settings**: change/disable the daily notification time, or reset all data.
- **Daily local notification**: fires at the time you chose (default 7:00 AM) with the
  Focusing Question, and opens straight to Today when tapped.

All data is stored on-device only (SQLite via `expo-sqlite`) — no account, no server, no
network calls.

## Running it

```bash
cd one-thing-app
npm install
npx expo start
```

- Scan the QR code with the **Expo Go** app on your phone (iOS or Android) — no build step
  needed for local notifications, they work in Expo Go.
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
                        notification scheduling, the book's framework copy
  components/          shared UI (prompt editor, streak badges, heatmap, ...)
```

## Notes

- Notifications are local-only (no push server, no account) — SDK 57's Expo Go build
  supports local notifications on both platforms; only remote push is restricted.
- The 66-day counter and streak are derived from your daily "done" marks — there's no
  separate habit-tracker screen to keep in sync.
