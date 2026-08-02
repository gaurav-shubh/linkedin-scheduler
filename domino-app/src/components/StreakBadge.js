import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export default function StreakBadge({ streak, habit }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.badge}>
          <Text style={styles.emoji}>🔥</Text>
          <View style={styles.flex}>
            <Text style={styles.num}>{streak}</Text>
            <Text style={styles.label}>day streak</Text>
          </View>
        </View>
        <View style={styles.badge}>
          <Text style={styles.emoji}>{habit.formed ? '🌱' : '📅'}</Text>
          <View style={styles.flex}>
            <Text style={styles.num}>{habit.dayInCycle}/{habit.cycleLength}</Text>
            <Text style={styles.label}>{habit.formed ? 'habit formed' : 'to habit'}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.total}>
        {habit.total} {habit.total === 1 ? 'day' : 'days'} focused all-time
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  total: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
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
