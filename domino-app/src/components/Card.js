import { StyleSheet, View } from 'react-native';
import { colors, elevation, radius, spacing } from '../theme';

export default function Card({ children, style, flat = false }) {
  return <View style={[styles.card, !flat && elevation.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
