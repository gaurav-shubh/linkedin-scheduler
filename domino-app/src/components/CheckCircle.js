import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, elevation, fonts, spacing } from '../theme';

const SIZE = 104;

/**
 * The day's single primary action: one oversized circular check-in. Coral ring while
 * the day is open; a green disc springs in when done. Tap again to undo.
 */
export default function CheckCircle({ done, onPress }) {
  const press = useSharedValue(1);
  const fill = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    fill.value = done
      ? withSpring(1, { damping: 12, stiffness: 180 })
      : withTiming(0, { duration: 180 });
  }, [done, fill]);

  const handlePress = () => {
    press.value = withSequence(
      withTiming(0.9, { duration: 90 }),
      withSpring(1, { damping: 10, stiffness: 240 })
    );
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        done ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success
      ).catch(() => {});
    }
    onPress();
  };

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const fillStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scale: 0.3 + fill.value * 0.7 }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={pressStyle}>
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={done ? 'Marked done — tap to undo' : 'Mark today done'}
          style={[styles.circle, !done && elevation.raised]}
        >
          <Animated.View style={[styles.fillDisc, fillStyle]} />
          <Text style={[styles.check, done ? styles.checkDone : styles.checkPending]}>✓</Text>
        </Pressable>
      </Animated.View>
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
    backgroundColor: colors.surface,
    borderWidth: 4,
    borderColor: colors.accent,
    overflow: 'hidden',
  },
  fillDisc: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: SIZE / 2,
    backgroundColor: colors.success,
  },
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
