import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Card from '../../src/components/Card';
import Button from '../../src/components/Button';
import { getAllSettings, setSetting } from '../../src/db/queries';
import { cancelDailyPrompt, ensurePermission, scheduleDailyPrompt } from '../../src/lib/notifications';
import { colors, spacing, typography } from '../../src/theme';

export default function Settings() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const s = await getAllSettings(db);
    setEnabled(s.notify_enabled === 'true');
    setHour(s.notify_hour !== undefined ? Number(s.notify_hour) : 7);
    setMinute(s.notify_minute !== undefined ? Number(s.notify_minute) : 0);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const timeLabel = `${hour % 12 === 0 ? 12 : hour % 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;

  const adjustMinutes = (delta) => {
    let total = hour * 60 + minute + delta;
    total = ((total % 1440) + 1440) % 1440;
    setHour(Math.floor(total / 60));
    setMinute(total % 60);
  };

  const toggleEnabled = async (value) => {
    setEnabled(value);
    if (value) {
      const granted = await ensurePermission();
      if (!granted) {
        setEnabled(false);
        Alert.alert('Notifications disabled', 'Enable notifications for this app in your device settings to get the daily prompt.');
        return;
      }
    }
    await setSetting(db, 'notify_enabled', value ? 'true' : 'false');
    if (value) {
      await scheduleDailyPrompt(hour, minute);
    } else {
      await cancelDailyPrompt();
    }
  };

  const saveTime = async () => {
    setSaving(true);
    await setSetting(db, 'notify_hour', hour);
    await setSetting(db, 'notify_minute', minute);
    if (enabled) await scheduleDailyPrompt(hour, minute);
    setSaving(false);
    Alert.alert('Saved', `Daily prompt set for ${timeLabel}.`);
  };

  const resetData = () => {
    Alert.alert(
      'Reset all data?',
      'This deletes every goal, weekly/monthly ONE Thing, and daily entry on this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            await db.execAsync(
              'DELETE FROM goals; DELETE FROM periods; DELETE FROM daily_entries; DELETE FROM settings;'
            );
            await cancelDailyPrompt();
            router.replace('/onboarding');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <Text style={typography.title}>Settings</Text>

      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={typography.heading}>Daily morning prompt</Text>
            <Text style={typography.muted}>Ask the focusing question every morning.</Text>
          </View>
          <Switch value={enabled} onValueChange={toggleEnabled} trackColor={{ true: colors.primary }} />
        </View>

        <View style={styles.timeRow}>
          <Text onPress={() => adjustMinutes(-15)} style={styles.timeAdjust}>–15m</Text>
          <Text style={styles.timeLabel}>{timeLabel}</Text>
          <Text onPress={() => adjustMinutes(15)} style={styles.timeAdjust}>+15m</Text>
        </View>
        <Button title="Save time" onPress={saveTime} loading={saving} style={styles.spacedTop} />
      </Card>

      <Card style={styles.card}>
        <Text style={typography.heading}>Reset</Text>
        <Text style={[typography.muted, styles.spacedTop]}>
          Clear all goals and tracked history and start onboarding again.
        </Text>
        <Button title="Reset all data" variant="secondary" onPress={resetData} style={styles.spacedTop} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  flex1: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  card: { marginTop: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  timeRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  timeAdjust: { color: colors.accent, fontWeight: '700', fontSize: 16, padding: spacing.sm },
  timeLabel: { fontSize: 24, fontWeight: '700', color: colors.text },
  spacedTop: { marginTop: spacing.md },
});
