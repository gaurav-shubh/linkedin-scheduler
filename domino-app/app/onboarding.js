import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Animated, { FadeInRight } from 'react-native-reanimated';
import Button from '../src/components/Button';
import Card from '../src/components/Card';
import { upsertGoal, setSetting } from '../src/db/queries';
import { ensurePermission } from '../src/lib/notifications';
import { NOTIFY_DEFAULTS, formatTime, resyncNotifications, shiftTime } from '../src/lib/schedule';
import { GOAL_LEVELS, ONBOARDING_INTRO, WHY } from '../src/lib/content';
import { colors, fonts, spacing, typography } from '../src/theme';

const STEPS = [
  ...ONBOARDING_INTRO.map((intro, i) => ({ type: 'intro', ...intro, key: `intro-${i}` })),
  { type: 'why', ...WHY, key: WHY.key },
  ...GOAL_LEVELS.map((g) => ({ type: 'goal', ...g, key: g.key })),
  { type: 'notify', key: 'notify' },
];

export default function Onboarding() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [notifyHour, setNotifyHour] = useState(7);
  const [notifyMinute, setNotifyMinute] = useState(0);
  const [saving, setSaving] = useState(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isAnswerable = current.type === 'goal' || current.type === 'why';
  const isBlank = isAnswerable && !(answers[current.key] || '').trim();

  const goNext = async () => {
    if (current.type === 'goal' || current.type === 'why') {
      await upsertGoal(db, current.key, (answers[current.key] || '').trim());
    }
    if (isLast) {
      setSaving(true);
      const granted = await ensurePermission();
      await setSetting(db, 'notify_hour', notifyHour);
      await setSetting(db, 'notify_minute', notifyMinute);
      await setSetting(db, 'notify_enabled', granted ? 'true' : 'false');
      await setSetting(db, 'evening_enabled', 'true');
      await setSetting(db, 'evening_hour', NOTIFY_DEFAULTS.eveningHour);
      await setSetting(db, 'evening_minute', NOTIFY_DEFAULTS.eveningMinute);
      await setSetting(db, 'kickoff_enabled', 'true');
      await setSetting(db, 'onboarded', 'true');
      if (granted) await resyncNotifications(db);
      router.replace('/(tabs)/today');
      return;
    }
    setStep((s) => s + 1);
  };

  const timeLabel = formatTime(notifyHour, notifyMinute);

  const adjustMinutes = (delta) => {
    const next = shiftTime(notifyHour, notifyMinute, delta);
    setNotifyHour(next.hour);
    setNotifyMinute(next.minute);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.progressRow}>
          {STEPS.map((s, i) => (
            <View key={s.key} style={[styles.dot, i <= step && styles.dotActive]} />
          ))}
        </View>

        <Animated.View key={current.key} entering={FadeInRight.duration(320).springify().damping(19).stiffness(170)}>
        {current.type === 'intro' && (
          <>
            <Text style={styles.wordmark}>Domino</Text>
            <Text style={styles.tagline}>One thing, done daily.</Text>
            <Card style={styles.card}>
              <Text style={typography.heading}>{current.title}</Text>
              <Text style={[typography.body, styles.spacedTop]}>{current.body}</Text>
            </Card>
          </>
        )}

        {(current.type === 'goal' || current.type === 'why') && (
          <Card style={styles.card}>
            <Text style={typography.label}>{current.label.toUpperCase()}</Text>
            <Text style={[typography.body, styles.spacedTop, styles.italic]}>{current.prompt}</Text>
            <Text style={[typography.muted, styles.spacedTop]}>{current.helper}</Text>
            <TextInput
              style={styles.input}
              multiline
              autoFocus
              value={answers[current.key] || ''}
              onChangeText={(text) => setAnswers((a) => ({ ...a, [current.key]: text }))}
              placeholder={current.type === 'why' ? 'Type your answer, or skip for now...' : 'Type your answer...'}
              placeholderTextColor="#999"
            />
          </Card>
        )}

        {current.type === 'notify' && (
          <Card style={styles.card}>
            <Text style={typography.heading}>Your morning question</Text>
            <Text style={[typography.body, styles.spacedTop]}>
              Every day at the time below, we'll ask the focusing question so you can set today's
              ONE Thing first thing in the morning. We'll also check in at 9:00 PM so a day you
              actually did doesn't get recorded as a miss — both are adjustable in Settings.
            </Text>
            <View style={styles.timeRow}>
              <Text onPress={() => adjustMinutes(-15)} style={styles.timeAdjust}>–15m</Text>
              <Text style={styles.timeLabel}>{timeLabel}</Text>
              <Text onPress={() => adjustMinutes(15)} style={styles.timeAdjust}>+15m</Text>
            </View>
          </Card>
        )}

        <Button
          title={isLast ? 'Start tracking' : isBlank ? 'Skip for now' : 'Continue'}
          onPress={goNext}
          loading={saving}
          style={styles.spacedTop}
        />
        {isBlank && !isLast && (
          <Text style={styles.skipHint}>You can fill this in later from the Goals tab.</Text>
        )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingTop: spacing.xl * 1.5, flexGrow: 1, justifyContent: 'center' },
  card: { marginBottom: spacing.md },
  spacedTop: { marginTop: spacing.md },
  italic: {},
  input: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    minHeight: 90,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'top',
  },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary },
  timeRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  timeAdjust: { color: colors.accent, fontFamily: fonts.bold, fontSize: 16, padding: spacing.sm },
  timeLabel: { fontFamily: fonts.display, fontSize: 28, color: colors.text },
  skipHint: {
    marginTop: spacing.sm,
    textAlign: 'center',
    fontSize: 13,
    color: colors.textMuted,
  },
  wordmark: {
    ...typography.display,
    fontSize: 40,
    lineHeight: 48,
    textAlign: 'center',
    color: colors.primaryDark,
  },
  tagline: {
    ...typography.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
});
