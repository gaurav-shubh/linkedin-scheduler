import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, elevation, fonts, radius, spacing } from '../theme';

export default function Button({ title, onPress, variant = 'primary', disabled, loading, style }) {
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        isPrimary && !disabled && !loading && elevation.card,
        variant === 'secondary' && styles.secondary,
        isGhost && styles.ghost,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : colors.primary} />
      ) : (
        <Text style={[styles.text, isPrimary ? styles.textPrimary : styles.textSecondary]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Chunky rounded-rect, bold label — reads as a solid tappable block.
  base: {
    borderRadius: radius.sm + 4,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.ink },
  secondary: { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.ink },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  text: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: 0.2 },
  textPrimary: { color: '#fff' },
  textSecondary: { color: colors.ink },
});
