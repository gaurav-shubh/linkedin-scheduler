import Animated, { FadeInDown } from 'react-native-reanimated';

/**
 * Staggered entrance used across screens: content rises and fades in, sections
 * cascading by `delay`. One primitive so all motion shares the same curve.
 */
export default function Reveal({ delay = 0, children, style }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(420).delay(delay).springify().damping(18).stiffness(160)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
