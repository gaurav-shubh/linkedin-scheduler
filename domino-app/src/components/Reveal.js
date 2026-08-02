import { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { delayUntilAppTime } from '../lib/appClock';
import { INTRO_REVEAL_MS } from './AnimatedIntro';

/**
 * Staggered entrance used across screens. Deliberately overdamped: content rises a
 * short distance on an ease-out curve with no wobble — text that oscillates reads
 * as machinery, not design. Honors the system reduce-motion setting. On cold open
 * the whole cascade is deferred until the intro overlay starts dissolving, so the
 * first thing seen is content rising through the fade rather than a finished page.
 */
export default function Reveal({ delay = 0, children, style }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <Animated.View style={style}>{children}</Animated.View>;
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(380)
        .delay(delay + delayUntilAppTime(INTRO_REVEAL_MS))
        .easing(Easing.out(Easing.cubic))
        .withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] })}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
