import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reveal from '../../src/components/Reveal';
import Card from '../../src/components/Card';
import GoalStepper from '../../src/components/GoalStepper';
import { getAllGoals, upsertGoal } from '../../src/db/queries';
import { FOUR_THIEVES, GOAL_LEVELS, WHY } from '../../src/lib/content';
import { colors, spacing, typography } from '../../src/theme';

const LEVELS = [WHY, ...GOAL_LEVELS];

export default function Goals() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [goals, setGoals] = useState(null);

  const load = useCallback(async () => {
    setGoals(await getAllGoals(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const save = async (level, text) => {
    await upsertGoal(db, level, text);
    await load();
  };

  // Wait for the first read so the stepper opens the right step, not a guess.
  if (goals === null) return null;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]}>
      <Reveal>
        <Text style={typography.title}>Your Goal Staircase</Text>
        <Text style={[typography.muted, styles.subtitle]}>
          One question at a time, from your why down to this year. Tap a step to answer or
          change it.
        </Text>

        <GoalStepper levels={LEVELS} values={goals} onSave={save} />

        <Text style={[typography.heading, styles.sectionTitle]}>The Four Thieves of Focus</Text>
        <Text style={typography.muted}>What tends to pull people away from their ONE Thing:</Text>
        <View style={styles.gap} />
        {FOUR_THIEVES.map((t) => (
          <Card key={t.title} style={styles.thiefCard}>
            <Text style={typography.body}>{t.title}</Text>
            <Text style={[typography.muted, styles.thiefBody]}>{t.body}</Text>
          </Card>
        ))}
      </Reveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  subtitle: { marginTop: spacing.xs, marginBottom: spacing.lg },
  gap: { height: spacing.md },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.xs },
  thiefCard: { marginBottom: spacing.sm },
  thiefBody: { marginTop: 4 },
});
