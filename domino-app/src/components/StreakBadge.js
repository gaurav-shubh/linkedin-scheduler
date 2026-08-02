import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { colors, elevation, fonts, radius, spacing, typography } from '../theme';

function AnimatedFill({ pct, formed }) {
  const width = useSharedValue(0);

  useEffect(() => {
    // Sweep from zero to the current value on mount and on change — the fill
    // growing is the reward moment, so it always animates.
    width.value = withDelay(
      350,
      withTiming(Math.max(pct, 2), { duration: 700, easing: Easing.out(Easing.cubic) })
    );
  }, [pct, width]);

  const style = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return <Animated.View style={[styles.fill, formed && styles.fillDone, style]} />;
}

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
          <AnimatedFill pct={pct} formed={habit.formed} />
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
