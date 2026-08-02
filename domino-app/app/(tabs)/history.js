import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reveal from '../../src/components/Reveal';
import Card from '../../src/components/Card';
import CompletionHeatmap from '../../src/components/CompletionHeatmap';
import StreakBadge from '../../src/components/StreakBadge';
import {
  countCompletedEntries,
  listDailyEntries,
  recentCompletionMap,
  setDailyCompleted,
} from '../../src/db/queries';
import { friendlyDate } from '../../src/lib/dates';
import { computeLongestStreak, computeStreak, habitProgress } from '../../src/lib/streak';
import { colors, fonts, spacing, typography } from '../../src/theme';

export default function History() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState([]);
  const [entriesByDate, setEntriesByDate] = useState({});
  const [streak, setStreak] = useState(0);
  const [longest, setLongest] = useState(0);
  const [habit, setHabit] = useState(habitProgress(0, 0));

  const load = useCallback(async () => {
    const [recent, heatmapRows, completedCount, allRows] = await Promise.all([
      listDailyEntries(db, { limit: 30 }),
      recentCompletionMap(db, 12 * 7),
      countCompletedEntries(db),
      listDailyEntries(db, { limit: 2000 }),
    ]);
    setEntries(recent);
    const map = {};
    for (const row of heatmapRows) map[row.date] = row;
    setEntriesByDate(map);
    const currentStreak = computeStreak(allRows);
    setStreak(currentStreak);
    setLongest(computeLongestStreak(allRows));
    setHabit(habitProgress(currentStreak, completedCount));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Missing a tap shouldn't cost a streak that was actually earned.
  const toggle = async (entry) => {
    await setDailyCompleted(db, entry.date, !entry.completed);
    await load();
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]}>
      <Reveal>
      <Text style={typography.title}>Your History</Text>
      <View style={styles.gap} />
      <StreakBadge streak={streak} habit={habit} />

      <View style={styles.gapLg} />
      <Card>
        <Text style={typography.label}>LAST 12 WEEKS</Text>
        <View style={styles.gap} />
        <CompletionHeatmap entriesByDate={entriesByDate} weeks={12} />
        <Text style={[typography.muted, styles.longest]}>Longest streak: {longest} days</Text>
      </Card>

      <Text style={[typography.label, styles.sectionTitle]}>RECENT DAYS</Text>
      <Text style={[typography.muted, styles.hint]}>
        Forgot to mark one? Tap any day to correct it.
      </Text>
      {entries.length === 0 && (
        <Text style={typography.muted}>No entries yet — set today's ONE Thing to get started.</Text>
      )}
      {entries.map((e) => (
        <Pressable key={e.date} onPress={() => toggle(e)} disabled={!e.one_thing}>
          {({ pressed }) => (
            <Card style={[styles.entryCard, pressed && styles.pressed]}>
              <View style={styles.entryRow}>
                <Text style={typography.muted}>{friendlyDate(e.date)}</Text>
                <Text style={e.completed ? styles.done : styles.pending}>
                  {e.completed ? '✓ done' : e.one_thing ? 'tap to mark done' : '—'}
                </Text>
              </View>
              {!!e.one_thing && <Text style={[typography.body, styles.entryText]}>{e.one_thing}</Text>}
            </Card>
          )}
        </Pressable>
      ))}
      </Reveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  gap: { height: spacing.sm },
  gapLg: { height: spacing.md },
  sectionTitle: { marginTop: spacing.lg },
  hint: { marginTop: 2, marginBottom: spacing.sm },
  longest: { marginTop: spacing.sm },
  entryCard: { marginBottom: spacing.sm },
  pressed: { opacity: 0.7 },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryText: { marginTop: 4 },
  done: { color: colors.success, fontFamily: fonts.bold },
  pending: { color: colors.accent, fontFamily: fonts.bold },
});
