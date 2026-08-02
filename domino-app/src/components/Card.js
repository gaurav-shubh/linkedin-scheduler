import { StyleSheet, View } from 'react-native';
import { colors, elevation, radius, spacing } from '../theme';

export default function Card({ children, style, flat = false }) {
  return <View style={[styles.card, !flat && elevation.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  // Borderless, big-radius, soft shadow — the Atoms card look.
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
