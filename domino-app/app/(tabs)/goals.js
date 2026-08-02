import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Card from '../../src/components/Card';
import PromptEditor from '../../src/components/PromptEditor';
import { getAllGoals, upsertGoal } from '../../src/db/queries';
import { FOUR_THIEVES, GOAL_LEVELS, WHY } from '../../src/lib/content';
import { colors, spacing, typography } from '../../src/theme';

export default function Goals() {
  const db = useSQLiteContext();
  const [goals, setGoals] = useState({});

  const load = useCallback(async () => {
    setGoals(await getAllGoals(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const save = (level) => async (text) => {
    await upsertGoal(db, level, text);
    await load();
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <Text style={typography.title}>Your Goal Staircase</Text>
      <Text style={[typography.muted, styles.subtitle]}>
        Your why at the top, then big goals broken down to the now. Each level should make the
        level above it easier.
      </Text>

      {[WHY, ...GOAL_LEVELS].map((g) => (
        <View key={g.key} style={styles.goalItem}>
          <PromptEditor
            label={g.label}
            question={g.prompt}
            value={goals[g.key]}
            placeholder="Type your answer..."
            onSave={save(g.key)}
          />
        </View>
      ))}

      <Text style={[typography.heading, styles.sectionTitle]}>The Four Thieves of Focus</Text>
      <Text style={typography.muted}>What tends to pull people away from their ONE Thing:</Text>
      <View style={styles.gap} />
      {FOUR_THIEVES.map((t) => (
        <Card key={t.title} style={styles.thiefCard}>
          <Text style={typography.body}>{t.title}</Text>
          <Text style={[typography.muted, styles.thiefBody]}>{t.body}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  subtitle: { marginTop: spacing.xs, marginBottom: spacing.lg },
  goalItem: { marginBottom: spacing.md },
  gap: { height: spacing.md },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.xs },
  thiefCard: { marginBottom: spacing.sm },
  thiefBody: { marginTop: 4 },
});
