import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Card from '../../src/components/Card';
import PromptEditor from '../../src/components/PromptEditor';
import StaircaseContext from '../../src/components/StaircaseContext';
import StreakBadge from '../../src/components/StreakBadge';
import {
  countCompletedEntries,
  getDailyEntry,
  getGoal,
  getPeriod,
  listDailyEntries,
  setDailyCompleted,
  upsertDailyEntry,
} from '../../src/db/queries';
import { dateKey, friendlyDate, monthKey, weekKey } from '../../src/lib/dates';
import { computeStreak, habitProgress } from '../../src/lib/streak';
import { DAILY_PROMPT, TIME_BLOCK_TIP } from '../../src/lib/content';
import { colors, spacing, typography } from '../../src/theme';

export default function Today() {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState(null);
  const [timeBlock, setTimeBlock] = useState('');
  const [context, setContext] = useState({ why: '', oneYear: '', month: '', week: '' });
  const [streak, setStreak] = useState(0);
  const [habit, setHabit] = useState(habitProgress(0));

  const today = dateKey();

  const load = useCallback(async () => {
    const [dailyEntry, whyGoal, oneYearGoal, monthPeriod, weekPeriod, recentEntries, completedCount] = await Promise.all([
      getDailyEntry(db, today),
      getGoal(db, 'why'),
      getGoal(db, 'one_year'),
      getPeriod(db, 'month', monthKey()),
      getPeriod(db, 'week', weekKey()),
      listDailyEntries(db, { limit: 400 }),
      countCompletedEntries(db),
    ]);
    setEntry(dailyEntry);
    setTimeBlock(dailyEntry?.time_block || '');
    setContext({
      why: whyGoal?.text || '',
      oneYear: oneYearGoal?.text || '',
      month: monthPeriod?.one_thing || '',
      week: weekPeriod?.one_thing || '',
    });
    setStreak(computeStreak(recentEntries));
    setHabit(habitProgress(completedCount));
    setLoading(false);
  }, [db, today]);

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

  if (loading) return null;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <Text style={typography.muted}>{friendlyDate(today)}</Text>
      <Text style={[typography.title, styles.title]}>Today's ONE Thing</Text>

      <StreakBadge streak={streak} habit={habit} />

      <View style={styles.spacer} />

      <StaircaseContext
        items={[
          { label: 'YOUR WHY', value: context.why },
          { label: 'ONE-YEAR GOAL', value: context.oneYear },
          { label: 'THIS MONTH', value: context.month },
          { label: 'THIS WEEK', value: context.week },
        ]}
      />

      <PromptEditor
        label="Today"
        question={DAILY_PROMPT}
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
