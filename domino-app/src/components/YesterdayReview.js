import { StyleSheet, Text, View } from 'react-native';
import Card from './Card';
import Button from './Button';
import { YESTERDAY_REVIEW } from '../lib/content';
import { friendlyDate } from '../lib/dates';
import { colors, fonts, spacing, typography } from '../theme';

/**
 * Surfaces yesterday's unmarked ONE Thing so a day that was actually done doesn't get
 * recorded as a miss just because nobody reopened the app.
 */
export default function YesterdayReview({ entry, onYes, onNo }) {
  return (
    <Card style={styles.card}>
      <Text style={typography.label}>{YESTERDAY_REVIEW.title.toUpperCase()}</Text>
      <Text style={[typography.muted, styles.date]}>{friendlyDate(entry.date)}</Text>
      <Text style={[typography.body, styles.text]}>{entry.one_thing}</Text>
      <Text style={[typography.muted, styles.question]}>{YESTERDAY_REVIEW.question}</Text>
      <View style={styles.row}>
        <Button title="Not this time" variant="secondary" onPress={onNo} style={styles.flex} />
        <Button title="Yes, I did it" onPress={onYes} style={styles.flex} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.accent },
  date: { marginTop: spacing.xs },
  text: { marginTop: spacing.xs, fontFamily: fonts.bold },
  question: { marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
});
