import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export default function StreakBadge({ streak, habit }) {
  return (
    <View style={styles.row}>
      <View style={styles.badge}>
        <Text style={styles.emoji}>🔥</Text>
        <View>
          <Text style={styles.num}>{streak}</Text>
          <Text style={styles.label}>day streak</Text>
        </View>
      </View>
      <View style={styles.badge}>
        <Text style={styles.emoji}>📅</Text>
        <View>
          <Text style={styles.num}>{habit.dayInCycle}/{habit.cycleLength}</Text>
          <Text style={styles.label}>habit cycle {habit.cycle}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  badge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  emoji: { fontSize: 24 },
  num: { fontSize: 18, fontWeight: '700', color: colors.text },
  label: { fontSize: 12, color: colors.textMuted },
});
