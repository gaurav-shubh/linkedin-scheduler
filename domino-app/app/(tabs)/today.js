import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Card from '../../src/components/Card';
import PromptEditor from '../../src/components/PromptEditor';
import StaircaseContext from '../../src/components/StaircaseContext';
import StreakBadge from '../../src/components/StreakBadge';
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
import { addDays, dateKey, friendlyDate, monthKey, weekKey } from '../../src/lib/dates';
import { computeStreak, habitProgress } from '../../src/lib/streak';
import {
  DAILY_PROMPT,
  DAILY_PROMPT_NO_WEEK,
  MISSING_RUNG,
  PERIOD_LEVELS,
  TIME_BLOCK_TIP,
} from '../../src/lib/content';
import { colors, spacing, typography } from '../../src/theme';

export default function Today() {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState(null);
  const [yesterday, setYesterday] = useState(null);
  const [timeBlock, setTimeBlock] = useState('');
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
    setTimeBlock(dailyEntry?.time_block || '');
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
    await upsertDailyEntry(db, today, { oneThing: text, timeBlock });
    await load();
  };

  const saveTimeBlock = async () => {
    if (!entry) return;
    await upsertDailyEntry(db, today, { oneThing: entry.one_thing, timeBlock });
  };

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

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <Text style={typography.muted}>{friendlyDate(today)}</Text>
      <Text style={[typography.title, styles.title]}>Today's ONE Thing</Text>

      <StreakBadge streak={streak} habit={habit} />

      <View style={styles.spacer} />

      {!!yesterday && (
        <YesterdayReview
          entry={yesterday}
          onYes={() => resolveYesterday(true)}
          onNo={() => resolveYesterday(false)}
        />
      )}

      <StaircaseContext
        items={[
          { label: 'YOUR WHY', value: context.why },
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

      <PromptEditor
        label="Today"
        question={context.week ? DAILY_PROMPT : DAILY_PROMPT_NO_WEEK}
        value={entry?.one_thing}
        placeholder="The one thing I'll do today is..."
        onSave={saveOneThing}
      />

      {!!entry?.one_thing && (
        <>
          <Card style={styles.spacedTop}>
            <Text style={typography.label}>TIME BLOCK</Text>
            <Text style={[typography.muted, styles.italic]}>{TIME_BLOCK_TIP}</Text>
            <TextInput
              style={styles.timeInput}
              value={timeBlock}
              onChangeText={setTimeBlock}
              onBlur={saveTimeBlock}
              placeholder="e.g. 7:00 – 9:00 AM"
              placeholderTextColor="#999"
            />
          </Card>

          <Pressable onPress={toggleComplete} style={[styles.completeButton, entry.completed && styles.completeButtonDone]}>
            <Text style={[styles.completeText, entry.completed && styles.completeTextDone]}>
              {entry.completed ? '✓ Done today' : 'Mark as done'}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { marginBottom: spacing.md },
  spacer: { height: spacing.md },
  spacedTop: { marginTop: spacing.md },
  italic: { fontStyle: 'italic', marginTop: 2 },
  missingWrap: { marginBottom: spacing.md },
  missingHeader: { marginBottom: spacing.sm },
  missingBody: { marginTop: spacing.xs },
  timeInput: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  completeButton: {
    marginTop: spacing.md,
    borderRadius: 14,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  completeButtonDone: { backgroundColor: colors.primary },
  completeText: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  completeTextDone: { color: '#fff' },
});
