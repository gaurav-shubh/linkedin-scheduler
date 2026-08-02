import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, fonts } from '../theme';

// Timeline (ms): dominoes tip 100/260/420 → wordmark rises 550 → fade out 1350 → gone 1850.
export const INTRO_TOTAL_MS = 1850;

function Domino({ delay, restAngle }) {
  const tip = useSharedValue(0);

  useEffect(() => {
    tip.value = withDelay(
      delay,
      withTiming(1, { duration: 340, easing: Easing.in(Easing.quad) })
    );
  }, [delay, tip]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tip.value * restAngle}deg` }],
  }));

  return <Animated.View style={[styles.domino, style]} />;
}

/**
 * Branded open: three dominoes tip into each other, the wordmark rises, and the
 * navy overlay dissolves into the app. Purely decorative — it never blocks input
 * for longer than its own lifetime and the parent unmounts it on a fixed timer.
 */
export default function AnimatedIntro() {
  const overlay = useSharedValue(1);
  const word = useSharedValue(0);

  useEffect(() => {
    word.value = withDelay(550, withSpring(1, { damping: 14, stiffness: 120 }));
    overlay.value = withDelay(1350, withTiming(0, { duration: 450 }));
  }, [overlay, word]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * 14 }],
  }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="none">
      {/* A real cascade leans progressively flatter the earlier it fell. */}
      <View style={styles.row}>
        <Domino delay={100} restAngle={76} />
        <Domino delay={260} restAngle={64} />
        <Domino delay={420} restAngle={50} />
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
