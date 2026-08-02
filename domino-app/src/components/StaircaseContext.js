import { StyleSheet, Text, View } from 'react-native';
import { colors, elevation, fonts, radius, spacing } from '../theme';

/**
 * The goal staircase as a connected set of steps: a dot-and-line rail down the left,
 * each rung's label and value beside it. Shown above the daily prompt so the answer
 * stays visibly derived from the level above.
 */
export default function StaircaseContext({ items }) {
  const filled = items.filter((i) => i.value);
  if (!filled.length) return null;
  return (
    <View style={[styles.card, elevation.card]}>
      {filled.map((item, i) => (
        <View key={item.label} style={styles.row}>
          <View style={styles.rail}>
            <View style={[styles.dot, i === filled.length - 1 && styles.dotCurrent]} />
            {i < filled.length - 1 && <View style={styles.line} />}
          </View>
          <View style={[styles.content, i < filled.length - 1 && styles.contentGap]}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.value} numberOfLines={2}>
              {item.value}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  row: { flexDirection: 'row' },
  rail: { width: 20, alignItems: 'center' },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.ink,
    marginTop: 3,
  },
  dotCurrent: { backgroundColor: colors.accent, borderColor: colors.accent },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  content: { flex: 1, marginLeft: spacing.sm },
  contentGap: { paddingBottom: spacing.md },
  label: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  value: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.text, marginTop: 1 },
});
