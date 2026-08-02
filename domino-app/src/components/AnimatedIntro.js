import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, fonts } from '../theme';

// Timeline (ms): dominoes tip 120/270/385 (a real cascade accelerates, so the
// gaps shrink) → wordmark rises 560 → overlay dissolves 1350 → unmounted 1850.
export const INTRO_REVEAL_MS = 1350;
export const INTRO_TOTAL_MS = 1850;

function Domino({ delay, restAngle }) {
  const angle = useSharedValue(0);

  useEffect(() => {
    // Gravity accelerates the fall (ease-in), then the tile lands on its
    // neighbour: a small overshoot and a quick settle back — the impact is
    // what makes it read as physical rather than keyframed.
    angle.value = withDelay(
      delay,
      withSequence(
        withTiming(restAngle + 6, { duration: 330, easing: Easing.in(Easing.quad) }),
        withTiming(restAngle, { duration: 120, easing: Easing.out(Easing.quad) })
      )
    );
  }, [angle, delay, restAngle]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));

  return <Animated.View style={[styles.domino, style]} />;
}

/**
 * Branded open: three dominoes tip into each other, the wordmark rises, and the
 * navy overlay dissolves with a slight push toward the viewer. Purely decorative —
 * it never blocks input and the parent unmounts it on a fixed timer.
 */
export default function AnimatedIntro() {
  const overlay = useSharedValue(1);
  const word = useSharedValue(0);

  useEffect(() => {
    word.value = withDelay(560, withSpring(1, { damping: 16, stiffness: 140 }));
    overlay.value = withDelay(
      INTRO_REVEAL_MS,
      withTiming(0, { duration: 460, easing: Easing.in(Easing.quad) })
    );
  }, [overlay, word]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlay.value,
    transform: [{ scale: 1 + (1 - overlay.value) * 0.035 }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * 12 }],
  }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="none">
      {/* A real cascade leans progressively flatter the earlier it fell. */}
      <View style={styles.row}>
        <Domino delay={120} restAngle={76} />
        <Domino delay={270} restAngle={64} />
        <Domino delay={385} restAngle={50} />
      </View>
      <Animated.Text style={[styles.wordmark, wordStyle]}>Domino</Animated.Text>
      <Animated.Text style={[styles.tagline, wordStyle]}>One thing, done daily.</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 34,
    marginBottom: 38,
    height: 84,
  },
  domino: {
    width: 22,
    height: 76,
    borderRadius: 8,
    backgroundColor: colors.background,
    transformOrigin: 'bottom right',
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 52,
    color: colors.textOnInk,
  },
  tagline: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.mutedOnInk,
    marginTop: 4,
  },
});
