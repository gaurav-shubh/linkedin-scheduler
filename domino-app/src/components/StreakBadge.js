import { StyleSheet, Text, View } from 'react-native';
import { colors, elevation, fonts, radius, spacing, typography } from '../theme';

/**
 * Atoms-style stats: two tiles with oversized numerals, then a rounded progress
 * bar toward the 66-day habit mark based on the current streak.
 */
export default function StreakBadge({ streak, habit }) {
  const pct = Math.min(100, Math.round((habit.dayInCycle / habit.cycleLength) * 100));
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={[styles.tile, elevation.card]}>
          <Text style={styles.numeral}>{streak}</Text>
          <Text style={styles.tileLabel}>day streak</Text>
        </View>
        <View style={[styles.tile, elevation.card]}>
          <Text style={styles.numeral}>{habit.total}</Text>
          <Text style={styles.tileLabel}>all-time</Text>
        </View>
      </View>

      <View style={[styles.progressCard, elevation.card]}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>{habit.formed ? 'Habit formed' : 'To habit'}</Text>
          <Text style={styles.progressCount}>
            {habit.dayInCycle}/{habit.cycleLength}
          </Text>
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.max(pct, 2)}%` },
              habit.formed && styles.fillDone,
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  numeral: { ...typography.numeral },
  tileLabel: { ...typography.muted, marginTop: 2 },
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  progressCount: { fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  fillDone: { backgroundColor: colors.success },
});
