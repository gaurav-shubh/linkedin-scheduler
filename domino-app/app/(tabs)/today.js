import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CheckCircle from '../../src/components/CheckCircle';
import GreetingHeader from '../../src/components/GreetingHeader';
import Reveal from '../../src/components/Reveal';
import PromptEditor from '../../src/components/PromptEditor';
import StaircaseContext from '../../src/components/StaircaseContext';
import StreakBadge from '../../src/components/StreakBadge';
import TimeBlock from '../../src/components/TimeBlock';
import YesterdayReview from '../../src/components/YesterdayReview';
import {
  countCompletedEntries,
  getDailyEntry,
  getGoal,
  getPeriod,
  getSetting,
  listDailyEntries,
  setDailyCompleted,
  setSetting,
  upsertDailyEntry,
  upsertPeriod,
} from '../../src/db/queries';
import { addDays, dateKey, monthKey, weekKey } from '../../src/lib/dates';
import { computeStreak, habitProgress } from '../../src/lib/streak';
import {
  DAILY_PROMPT,
  DAILY_PROMPT_NO_WEEK,
  MISSING_RUNG,
  PERIOD_LEVELS,
} from '../../src/lib/content';
import { scheduleTimeBlock } from '../../src/lib/notifications';
import { shiftTime } from '../../src/lib/schedule';
import { colors, spacing, typography } from '../../src/theme';

const DEFAULT_BLOCK_HOUR = 9;

/** The book argues for the same block every day, so yesterday's choice seeds today's. */
function defaultBlockHour(previousEntry) {
  const prev = previousEntry?.time_block_hour;
  return prev === null || prev === undefined ? DEFAULT_BLOCK_HOUR : prev;
}

export default function Today() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState(null);
  const [yesterday, setYesterday] = useState(null);
  const [block, setBlock] = useState({ enabled: false, hour: DEFAULT_BLOCK_HOUR, minute: 0 });
  const [context, setContext] = useState({ why: '', oneYear: '', month: '', week: '' });
  const [streak, setStreak] = useState(0);
  const [habit, setHabit] = useState(habitProgress(0, 0));

  const today = dateKey();
  const yesterdayKey = dateKey(addDays(new Date(), -1));

  const load = useCallback(async () => {
    const [
      dailyEntry,
      prevEntry,
      reviewedUpTo,
      whyGoal,
      oneYearGoal,
      monthPeriod,
      weekPeriod,
      recentEntries,
      completedCount,
    ] = await Promise.all([
      getDailyEntry(db, today),
      getDailyEntry(db, yesterdayKey),
      getSetting(db, 'last_reviewed_date'),
      getGoal(db, 'why'),
      getGoal(db, 'one_year'),
      getPeriod(db, 'month', monthKey()),
      getPeriod(db, 'week', weekKey()),
      listDailyEntries(db, { limit: 400 }),
      countCompletedEntries(db),
    ]);

    setEntry(dailyEntry);
    const hasBlock = dailyEntry?.time_block_hour !== null && dailyEntry?.time_block_hour !== undefined;
    setBlock({
      enabled: hasBlock,
      hour: hasBlock ? dailyEntry.time_block_hour : defaultBlockHour(prevEntry),
      minute: hasBlock ? dailyEntry.time_block_minute ?? 0 : 0,
    });
    // Only ask about yesterday if it was actually planned, left unmarked, and not
    // already answered — otherwise the card would nag forever.
    const needsReview =
      prevEntry && prevEntry.one_thing && !prevEntry.completed && reviewedUpTo !== yesterdayKey;
    setYesterday(needsReview ? prevEntry : null);
    setContext({
      why: whyGoal?.text || '',
      oneYear: oneYearGoal?.text || '',
      month: monthPeriod?.one_thing || '',
      week: weekPeriod?.one_thing || '',
    });
    const currentStreak = computeStreak(recentEntries);
    setStreak(currentStreak);
    setHabit(habitProgress(currentStreak, completedCount));
    setLoading(false);
  }, [db, today, yesterdayKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const saveOneThing = async (text) => {
    await upsertDailyEntry(db, today, {
      oneThing: text,
      timeBlockHour: block.enabled ? block.hour : null,
      timeBlockMinute: block.enabled ? block.minute : null,
    });
    if (block.enabled) {
      await scheduleTimeBlock({ hour: block.hour, minute: block.minute, oneThing: text });
    }
    await load();
  };

  // Persist the block and (re)schedule its reminder in one step, so the stored time and
  // the pending notification can never drift apart.
  const applyBlock = async (next) => {
    setBlock(next);
    if (!entry) return;
    await upsertDailyEntry(db, today, {
      oneThing: entry.one_thing,
      timeBlockHour: next.enabled ? next.hour : null,
      timeBlockMinute: next.enabled ? next.minute : null,
    });
    await scheduleTimeBlock({
      hour: next.enabled ? next.hour : null,
      minute: next.minute,
      oneThing: entry.one_thing,
    });
  };

  const toggleBlock = (enabled) => applyBlock({ ...block, enabled });
  const shiftBlock = (delta) => applyBlock({ ...block, ...shiftTime(block.hour, block.minute, delta) });

  const toggleComplete = async () => {
    if (!entry) return;
    await setDailyCompleted(db, today, !entry.completed);
    await load();
  };

  const resolveYesterday = async (didIt) => {
    if (didIt) await setDailyCompleted(db, yesterdayKey, true);
    await setSetting(db, 'last_reviewed_date', yesterdayKey);
    await load();
  };

  const saveMissingRung = (level) => async (text) => {
    await upsertPeriod(db, level, level === 'month' ? monthKey() : weekKey(), text);
    await load();
  };

  if (loading) return null;

  // Walk the staircase top-down and prompt for the highest missing rung, so the daily
  // question always has something real to derive from.
  const missingLevel = !context.month ? 'month' : !context.week ? 'week' : null;

  const now = new Date();
  const blockHasPassed = block.hour * 60 + block.minute <= now.getHours() * 60 + now.getMinutes();

  // Anchor the day's quote to their own reason for using the app at all.
  const anchor = context.why || context.oneYear || '';

  return (
    <ScrollView style={styles.flex} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]}>
      <Reveal delay={0}>
        <GreetingHeader
          dateKey={today}
          hour={now.getHours()}
          streak={streak}
          totalCompleted={habit.total}
          anchor={anchor}
        />
      </Reveal>

      <Reveal delay={90}>
        <StreakBadge streak={streak} habit={habit} />
      </Reveal>

      <View style={styles.spacer} />

      {!!yesterday && (
        <Reveal delay={150}>
          <YesterdayReview
            entry={yesterday}
            onYes={() => resolveYesterday(true)}
            onNo={() => resolveYesterday(false)}
          />
        </Reveal>
      )}

      <Reveal delay={180}>
        {/* The Why already anchors the quote above — repeating it here would be noise. */}
        <StaircaseContext
          items={[
            { label: 'ONE-YEAR GOAL', value: context.oneYear },
            { label: 'THIS MONTH', value: context.month },
            { label: 'THIS WEEK', value: context.week },
          ]}
        />

        {!!missingLevel && (
          <View style={styles.missingWrap}>
            <View style={styles.missingHeader}>
              <Text style={typography.heading}>{MISSING_RUNG[missingLevel].title}</Text>
              <Text style={[typography.muted, styles.missingBody]}>
                {MISSING_RUNG[missingLevel].body}
              </Text>
            </View>
            <PromptEditor
              // Remount per level; the editor keeps its own draft and `value` stays ""
              // across the month -> week transition, so it would otherwise carry text over.
              key={missingLevel}
              label={PERIOD_LEVELS[missingLevel].label}
              question={PERIOD_LEVELS[missingLevel].prompt}
              value=""
              placeholder="The one thing I'll focus on is..."
              onSave={saveMissingRung(missingLevel)}
            />
          </View>
        )}
      </Reveal>

      <Reveal delay={260}>
        <PromptEditor
          label="Today"
          question={context.week ? DAILY_PROMPT : DAILY_PROMPT_NO_WEEK}
          value={entry?.one_thing}
          placeholder="The one thing I'll do today is..."
          onSave={saveOneThing}
        />
      </Reveal>

      {!!entry?.one_thing && (
        <Reveal delay={330}>
          <TimeBlock
            hour={block.hour}
            minute={block.minute}
            enabled={block.enabled}
            onToggle={toggleBlock}
            onShift={shiftBlock}
            passed={block.enabled && blockHasPassed}
          />

          <CheckCircle done={!!entry.completed} onPress={toggleComplete} />
        </Reveal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  spacer: { height: spacing.md },
  missingWrap: { marginBottom: spacing.md },
  missingHeader: { marginBottom: spacing.sm },
  missingBody: { marginTop: spacing.xs },
});
