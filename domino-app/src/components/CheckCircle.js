import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, elevation, fonts, spacing } from '../theme';

const SIZE = 104;

/**
 * The day's single primary action: one oversized circular check-in. Coral ring while
 * the day is open; fills solid green once done. Tap again to undo.
 */
export default function CheckCircle({ done, onPress }) {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={done ? 'Marked done — tap to undo' : 'Mark today done'}
        style={({ pressed }) => [
          styles.circle,
          done ? styles.circleDone : styles.circlePending,
          !done && elevation.raised,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.check, done ? styles.checkDone : styles.checkPending]}>✓</Text>
      </Pressable>
      <Text style={styles.caption}>{done ? 'Done today' : 'Tap when it’s done'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: spacing.lg },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePending: {
    backgroundColor: colors.surface,
    borderWidth: 4,
    borderColor: colors.accent,
  },
  circleDone: {
    backgroundColor: colors.success,
  },
  pressed: { transform: [{ scale: 0.95 }] },
  check: { fontSize: 44, lineHeight: 52, fontFamily: fonts.display },
  checkPending: { color: colors.accent },
  checkDone: { color: '#fff' },
  caption: {
    marginTop: spacing.sm,
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textMuted,
  },
});
