import { StyleSheet, Switch, Text, View } from 'react-native';
import Card from './Card';
import { TIME_BLOCK_TIP } from '../lib/content';
import { SCHEDULING_SUPPORTED } from '../lib/notifications';
import { formatTime } from '../lib/schedule';
import { colors, spacing, typography } from '../theme';

/**
 * A real time block: picking a time schedules a reminder for it, rather than the
 * free-text note this used to be, which looked like a commitment but did nothing.
 */
export default function TimeBlock({ hour, minute, enabled, onToggle, onShift, passed }) {
  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text style={typography.label}>TIME BLOCK</Text>
          <Text style={[typography.muted, styles.tip]}>{TIME_BLOCK_TIP}</Text>
        </View>
        <Switch value={enabled} onValueChange={onToggle} trackColor={{ true: colors.primary }} />
      </View>

      {enabled && (
        <>
          <View style={styles.timeRow}>
            <Text onPress={() => onShift(-15)} style={styles.adjust}>–15m</Text>
            <Text style={styles.time}>{formatTime(hour, minute)}</Text>
            <Text onPress={() => onShift(15)} style={styles.adjust}>+15m</Text>
          </View>
          <Text style={[typography.muted, styles.status]}>
            {!SCHEDULING_SUPPORTED
              ? 'The block is saved. Reminders only fire on a phone, not in a browser.'
              : passed
                ? 'That time has already passed today — no reminder will fire until you pick a later one.'
                : "We'll remind you when the block starts."}
          </Text>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  tip: { marginTop: 2 },
  timeRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  adjust: { color: colors.accent, fontWeight: '700', fontSize: 16, padding: spacing.sm },
  time: { fontSize: 24, fontWeight: '700', color: colors.text },
  status: { marginTop: spacing.sm, textAlign: 'center' },
});
