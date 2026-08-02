import { StyleSheet, Text, View } from 'react-native';
import { greetingForHour, quoteForDay } from '../lib/quotes';
import { friendlyDate } from '../lib/dates';
import { colors, elevation, radius, spacing, typography } from '../theme';

/**
 * The first thing seen on open: a deep navy hero card with a greeting, one quote
 * chosen for where the user actually is, and their own reason for doing any of
 * this anchored underneath.
 */
export default function GreetingHeader({ dateKey, hour, streak, totalCompleted, anchor }) {
  const { text } = quoteForDay(dateKey, { hour, streak, totalCompleted });

  return (
    <View style={[styles.hero, elevation.raised]}>
      <Text style={styles.date}>{friendlyDate(dateKey).toUpperCase()}</Text>
      <Text style={styles.greeting}>{greetingForHour(hour)}.</Text>
      <Text style={styles.quote}>“{text}”</Text>
      {!!anchor && (
        <View style={styles.anchorRow}>
          <View style={styles.anchorDot} />
          <Text style={styles.anchorText} numberOfLines={2}>
            {anchor}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  date: { ...typography.label, color: colors.mutedOnInk },
  greeting: {
    ...typography.display,
    color: colors.textOnInk,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  quote: { ...typography.quote, color: colors.textOnInk, opacity: 0.92 },
  anchorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  anchorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  anchorText: { ...typography.muted, flex: 1, color: colors.mutedOnInk },
});
