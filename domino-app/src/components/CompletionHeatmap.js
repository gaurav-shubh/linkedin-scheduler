import { StyleSheet, Text, View } from 'react-native';
import { addDays, dateKey } from '../lib/dates';
import { colors, spacing } from '../theme';

// Renders the trailing `weeks` weeks as columns of 7 days (GitHub-style), ending today.
export default function CompletionHeatmap({ entriesByDate, weeks = 12 }) {
  const totalDays = weeks * 7;
  const today = new Date();
  const days = [];
  for (let i = totalDays - 1; i >= 0; i -= 1) {
    const d = addDays(today, -i);
    days.push(d);
  }
  const columns = [];
  for (let c = 0; c < days.length; c += 7) {
    columns.push(days.slice(c, c + 7));
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {columns.map((col, i) => (
          <View key={i} style={styles.col}>
            {col.map((d) => {
              const key = dateKey(d);
              const entry = entriesByDate[key];
              const future = d > today;
              let bg = colors.border;
              if (!future && entry) bg = entry.completed ? colors.success : '#E7C9BC';
              return <View key={key} style={[styles.cell, { backgroundColor: future ? 'transparent' : bg }]} />;
            })}
          </View>
        ))}
      </View>
      <View style={styles.legendRow}>
        <View style={[styles.cell, { backgroundColor: colors.success }]} />
        <Text style={styles.legendText}>done</Text>
        <View style={[styles.cell, { backgroundColor: '#E7C9BC' }]} />
        <Text style={styles.legendText}>set, not done</Text>
        <View style={[styles.cell, { backgroundColor: colors.border }]} />
        <Text style={styles.legendText}>no entry</Text>
      </View>
    </View>
  );
}

const CELL = 12;

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  grid: { flexDirection: 'row', gap: 3 },
  col: { gap: 3 },
  cell: { width: CELL, height: CELL, borderRadius: 3 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  legendText: { fontSize: 11, color: colors.textMuted, marginRight: spacing.sm },
});
