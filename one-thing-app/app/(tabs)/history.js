import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Card from '../../src/components/Card';
import CompletionHeatmap from '../../src/components/CompletionHeatmap';
import StreakBadge from '../../src/components/StreakBadge';
import { countCompletedEntries, listDailyEntries, recentCompletionMap } from '../../src/db/queries';
import { friendlyDate } from '../../src/lib/dates';
import { computeStreak, habitProgress } from '../../src/lib/streak';
import { colors, spacing, typography } from '../../src/theme';

export default function History() {
  const db = useSQLiteContext();
  const [entries, setEntries] = useState([]);
  const [entriesByDate, setEntriesByDate] = useState({});
  const [streak, setStreak] = useState(0);
  const [habit, setHabit] = useState(habitProgress(0));

  const load = useCallback(async () => {
    const [recent, heatmapRows, completedCount] = await Promise.all([
      listDailyEntries(db, { limit: 30 }),
      recentCompletionMap(db, 12 * 7),
      countCompletedEntries(db),
    ]);
    setEntries(recent);
    const map = {};
    for (const row of heatmapRows) map[row.date] = row;
    setEntriesByDate(map);
    setStreak(computeStreak(heatmapRows));
    setHabit(habitProgress(completedCount));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <Text style={typography.title}>Your History</Text>
      <View style={styles.gap} />
      <StreakBadge streak={streak} habit={habit} />

      <View style={styles.gapLg} />
      <Card>
        <Text style={typography.label}>LAST 12 WEEKS</Text>
        <View style={styles.gap} />
        <CompletionHeatmap entriesByDate={entriesByDate} weeks={12} />
      </Card>

      <Text style={[typography.label, styles.sectionTitle]}>RECENT DAYS</Text>
      {entries.length === 0 && <Text style={typography.muted}>No entries yet — set today's ONE Thing to get started.</Text>}
      {entries.map((e) => (
        <Card key={e.date} style={styles.entryCard}>
          <View style={styles.entryRow}>
            <Text style={typography.muted}>{friendlyDate(e.date)}</Text>
            <Text style={e.completed ? styles.done : styles.pending}>
              {e.completed ? '✓ done' : e.one_thing ? 'set' : '—'}
            </Text>
          </View>
          {!!e.one_thing && <Text style={[typography.body, styles.entryText]}>{e.one_thing}</Text>}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  gap: { height: spacing.sm },
  gapLg: { height: spacing.md },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm },
  entryCard: { marginBottom: spacing.sm },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryText: { marginTop: 4 },
  done: { color: colors.success, fontWeight: '700' },
  pending: { color: colors.textMuted, fontWeight: '600' },
});
