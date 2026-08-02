import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Card from '../../src/components/Card';
import Button from '../../src/components/Button';
import { getAllSettings, setSetting } from '../../src/db/queries';
import { cancelAllPrompts, ensurePermission } from '../../src/lib/notifications';
import { NOTIFY_DEFAULTS, formatTime, resyncNotifications, shiftTime } from '../../src/lib/schedule';
import { collectExport, entriesToCsv, exportFilenames } from '../../src/lib/export';
import { saveAndShare } from '../../src/lib/share';
import { colors, spacing, typography } from '../../src/theme';

function TimeRow({ label, hour, minute, onShift }) {
  return (
    <>
      {!!label && <Text style={[typography.label, styles.timeCaption]}>{label}</Text>}
      <View style={styles.timeRow}>
        <Text onPress={() => onShift(-15)} style={styles.timeAdjust}>–15m</Text>
        <Text style={styles.timeLabel}>{formatTime(hour, minute)}</Text>
        <Text onPress={() => onShift(15)} style={styles.timeAdjust}>+15m</Text>
      </View>
    </>
  );
}

export default function Settings() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(NOTIFY_DEFAULTS.morningHour);
  const [minute, setMinute] = useState(NOTIFY_DEFAULTS.morningMinute);
  const [eveningEnabled, setEveningEnabled] = useState(NOTIFY_DEFAULTS.eveningEnabled);
  const [eveningHour, setEveningHour] = useState(NOTIFY_DEFAULTS.eveningHour);
  const [eveningMinute, setEveningMinute] = useState(NOTIFY_DEFAULTS.eveningMinute);
  const [kickoffEnabled, setKickoffEnabled] = useState(NOTIFY_DEFAULTS.kickoffEnabled);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(null);

  const load = useCallback(async () => {
    const s = await getAllSettings(db);
    setEnabled(s.notify_enabled === 'true');
    setHour(s.notify_hour !== undefined ? Number(s.notify_hour) : NOTIFY_DEFAULTS.morningHour);
    setMinute(
      s.notify_minute !== undefined ? Number(s.notify_minute) : NOTIFY_DEFAULTS.morningMinute
    );
    setEveningEnabled(s.evening_enabled !== 'false');
    setEveningHour(
      s.evening_hour !== undefined ? Number(s.evening_hour) : NOTIFY_DEFAULTS.eveningHour
    );
    setEveningMinute(
      s.evening_minute !== undefined ? Number(s.evening_minute) : NOTIFY_DEFAULTS.eveningMinute
    );
    setKickoffEnabled(s.kickoff_enabled !== 'false');
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleEnabled = async (value) => {
    setEnabled(value);
    if (value) {
      const granted = await ensurePermission();
      if (!granted) {
        setEnabled(false);
        Alert.alert(
          'Notifications disabled',
          'Enable notifications for this app in your device settings to get the daily prompt.'
        );
        return;
      }
    }
    await setSetting(db, 'notify_enabled', value ? 'true' : 'false');
    if (value) {
      await resyncNotifications(db);
    } else {
      await cancelAllPrompts();
    }
  };

  const toggleFlag = (key, setter) => async (value) => {
    setter(value);
    await setSetting(db, key, value ? 'true' : 'false');
    if (enabled) await resyncNotifications(db);
  };

  const save = async () => {
    setSaving(true);
    await setSetting(db, 'notify_hour', hour);
    await setSetting(db, 'notify_minute', minute);
    await setSetting(db, 'evening_hour', eveningHour);
    await setSetting(db, 'evening_minute', eveningMinute);
    if (enabled) await resyncNotifications(db);
    setSaving(false);
    Alert.alert('Saved', `Morning prompt at ${formatTime(hour, minute)}.`);
  };

  const shiftMorning = (delta) => {
    const next = shiftTime(hour, minute, delta);
    setHour(next.hour);
    setMinute(next.minute);
  };

  const shiftEvening = (delta) => {
    const next = shiftTime(eveningHour, eveningMinute, delta);
    setEveningHour(next.hour);
    setEveningMinute(next.minute);
  };

  const runExport = (format) => async () => {
    setExporting(format);
    try {
      const generatedAt = new Date().toISOString();
      const payload = await collectExport(db, generatedAt);
      const names = exportFilenames(generatedAt);
      const isJson = format === 'json';
      const result = await saveAndShare({
        filename: isJson ? names.json : names.csv,
        contents: isJson
          ? JSON.stringify(payload, null, 2)
          : entriesToCsv(payload.dailyEntries),
        mimeType: isJson ? 'application/json' : 'text/csv',
        dialogTitle: isJson ? 'Domino backup' : 'Domino daily entries',
      });
      if (result.method === 'file') {
        Alert.alert('Saved', `Sharing isn't available, so the file was written to:\n${result.uri}`);
      } else if (result.method === 'download') {
        Alert.alert('Downloaded', `${payload.counts.dailyEntries} entries exported.`);
      }
    } catch (e) {
      Alert.alert('Export failed', e?.message ?? 'Something went wrong writing the file.');
    } finally {
      setExporting(null);
    }
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
            await cancelAllPrompts();
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
        <TimeRow hour={hour} minute={minute} onShift={shiftMorning} />
      </Card>

      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={typography.heading}>Evening check-in</Text>
            <Text style={typography.muted}>
              A nudge to mark today done, so a day you actually did isn't recorded as a miss.
            </Text>
          </View>
          <Switch
            value={eveningEnabled}
            onValueChange={toggleFlag('evening_enabled', setEveningEnabled)}
            trackColor={{ true: colors.primary }}
          />
        </View>
        {eveningEnabled && (
          <TimeRow hour={eveningHour} minute={eveningMinute} onShift={shiftEvening} />
        )}
      </Card>

      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={typography.heading}>Week & month kickoff</Text>
            <Text style={typography.muted}>
              Remind me each Monday and on the 1st to set the bigger ONE Thing.
            </Text>
          </View>
          <Switch
            value={kickoffEnabled}
            onValueChange={toggleFlag('kickoff_enabled', setKickoffEnabled)}
            trackColor={{ true: colors.primary }}
          />
        </View>
      </Card>

      <Button title="Save times" onPress={save} loading={saving} style={styles.spacedTop} />

      <Card style={styles.card}>
        <Text style={typography.heading}>Export your data</Text>
        <Text style={[typography.muted, styles.spacedTop]}>
          Everything lives on this device only. Export a backup so losing your phone doesn't
          lose your history.
        </Text>
        <Button
          title="Export backup (JSON)"
          onPress={runExport('json')}
          loading={exporting === 'json'}
          style={styles.spacedTop}
        />
        <Button
          title="Export entries (CSV)"
          variant="secondary"
          onPress={runExport('csv')}
          loading={exporting === 'csv'}
          style={styles.spacedTop}
        />
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
  timeCaption: { marginTop: spacing.md, textAlign: 'center' },
  timeRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  timeAdjust: { color: colors.accent, fontWeight: '700', fontSize: 16, padding: spacing.sm },
  timeLabel: { fontSize: 24, fontWeight: '700', color: colors.text },
  spacedTop: { marginTop: spacing.md },
});
