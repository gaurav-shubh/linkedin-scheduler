import { StyleSheet, Text, View } from 'react-native';
import { greetingForHour, quoteForDay } from '../lib/quotes';
import { friendlyDate } from '../lib/dates';
import { colors, radius, spacing, typography } from '../theme';

/**
 * The first thing seen on open: a greeting, one quote chosen for where the user
 * actually is (fresh start / momentum / comeback / evening), and their own reason
 * for doing any of this anchored underneath it.
 */
export default function GreetingHeader({ dateKey, hour, streak, totalCompleted, anchor }) {
  const { text } = quoteForDay(dateKey, { hour, streak, totalCompleted });

  return (
    <View style={styles.wrap}>
      <Text style={typography.muted}>{friendlyDate(dateKey)}</Text>
      <Text style={[typography.display, styles.greeting]}>{greetingForHour(hour)}.</Text>

      <View style={styles.quoteCard}>
        <Text style={[typography.quote, styles.quoteText]}>“{text}”</Text>
        {!!anchor && (
          <View style={styles.anchorRow}>
            <View style={styles.anchorRule} />
            <Text style={[typography.muted, styles.anchorText]} numberOfLines={2}>
              {anchor}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  greeting: { marginTop: 2, marginBottom: spacing.md },
  quoteCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  quoteText: { color: colors.primaryDark },
  anchorRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm },
  anchorRule: { width: 16, height: 1, backgroundColor: colors.primary, opacity: 0.5 },
  anchorText: { flex: 1, color: colors.primaryDark },
});
