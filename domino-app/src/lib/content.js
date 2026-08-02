// Original paraphrase of concepts from "The ONE Thing" by Gary Keller & Jay Papasan,
// plus a single purpose anchor inspired by Simon Sinek's "Start With Why".
// Not verbatim book text — short framework names/questions are used for reference only.

export const FOCUSING_QUESTION =
  "What's the ONE Thing I can do such that by doing it everything else will be easier or unnecessary?";

export const WHY = {
  key: 'why',
  label: 'Your Why',
  short: 'Why',
  prompt: "What's your Why — the belief or cause that makes this all worth pursuing?",
  helper: 'Optional. This sits above the staircase as the purpose everything else ladders up to.',
};

export const GOAL_LEVELS = [
  {
    key: 'someday',
    label: 'Someday Goal',
    short: 'Someday',
    prompt: 'If you could achieve any one thing in your life, what would it be?',
    helper: 'Your biggest-picture "someday" vision. Everything else on the staircase should ladder up to this.',
  },
  {
    key: 'five_year',
    label: 'Five-Year Goal',
    short: '5-Year',
    prompt: "Based on your someday goal, what's the ONE thing you could achieve in the next 5 years?",
    helper: 'Working backward from someday, what has to be true in 5 years?',
  },
  {
    key: 'one_year',
    label: 'One-Year Goal',
    short: '1-Year',
    prompt: "Based on your five-year goal, what's the ONE thing you should focus on this year?",
    helper: 'The one-year goal is a checkpoint on the way to your five-year goal.',
  },
];

export const PERIOD_LEVELS = {
  month: {
    label: 'Monthly',
    prompt: "Based on your one-year goal, what's the ONE thing you can do this month?",
  },
  week: {
    label: 'Weekly',
    prompt: "Based on this month's ONE thing, what's the ONE thing you can do this week?",
  },
};

export const DAILY_PROMPT = "Based on this week's ONE thing, what's the ONE thing you can do today?";

export const FOUR_THIEVES = [
  {
    title: "Inability to say \"no\"",
    body: 'Every yes to something small is a no to your ONE Thing. Protect your time block like an appointment you can\'t miss.',
  },
  {
    title: 'Fear of chaos',
    body: 'Letting other priorities slide while you focus feels risky. Decide in advance what you\'re willing to let go of for now.',
  },
  {
    title: 'Poor health habits',
    body: 'Low energy shrinks your capacity for focused work. Sleep, movement, and food are part of the plan, not separate from it.',
  },
  {
    title: 'Environment doesn\'t support your goals',
    body: 'Your surroundings and the people around you either pull you toward your ONE Thing or away from it. Adjust what you can.',
  },
];

export const TIME_BLOCK_TIP =
  'Block time for your ONE Thing before anything else claims your calendar — treat it as non-negotiable.';

export const ONBOARDING_INTRO = [
  {
    title: 'One question, asked daily',
    body: "The book's central idea: extraordinary results come from narrowing your focus, not widening it. Each day, week, month and year, you ask one focusing question and commit to a single answer.",
  },
  {
    title: 'Goal setting to the now',
    body: 'Big goals get broken down into a staircase: your why → someday → five years → one year → this month → this week → today. Each step should make the step above it easier.',
  },
  {
    title: "Let's set your staircase",
    body: "We'll start from the top (your why and someday goal) and work down. You can always edit these later from the Goals tab.",
  },
];
