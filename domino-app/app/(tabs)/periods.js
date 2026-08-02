import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reveal from '../../src/components/Reveal';
import Card from '../../src/components/Card';
import PromptEditor from '../../src/components/PromptEditor';
import StaircaseContext from '../../src/components/StaircaseContext';
import { getGoal, getPeriod, listPeriods, upsertPeriod } from '../../src/db/queries';
import { monthKey, monthLabel, weekKey, weekRangeLabel } from '../../src/lib/dates';
import { PERIOD_LEVELS } from '../../src/lib/content';
import { colors, fonts, spacing, typography } from '../../src/theme';

export default function Periods() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('week');
  const [why, setWhy] = useState('');
  const [oneYear, setOneYear] = useState('');
  const [monthOneThing, setMonthOneThing] = useState('');
  const [current, setCurrent] = useState(null);
  const [past, setPast] = useState([]);

  const periodKey = tab === 'week' ? weekKey() : monthKey();
  const label = tab === 'week' ? weekRangeLabel(periodKey) : monthLabel(periodKey);

  const load = useCallback(async () => {
    const [whyGoal, oneYearGoal, monthPeriod, currentPeriod, pastPeriods] = await Promise.all([
      getGoal(db, 'why'),
      getGoal(db, 'one_year'),
      getPeriod(db, 'month', monthKey()),
      getPeriod(db, tab, periodKey),
      listPeriods(db, tab, 8),
    ]);
    setWhy(whyGoal?.text || '');
    setOneYear(oneYearGoal?.text || '');
    setMonthOneThing(monthPeriod?.one_thing || '');
    setCurrent(currentPeriod);
    setPast(pastPeriods.filter((p) => p.period_key !== periodKey));
  }, [db, tab, periodKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const save = async (text) => {
    await upsertPeriod(db, tab, periodKey, text);
    await load();
  };

  const staircaseItems =
    tab === 'week'
      ? [
          { label: 'YOUR WHY', value: why },
          { label: 'ONE-YEAR GOAL', value: oneYear },
          { label: 'THIS MONTH', value: monthOneThing },
        ]
      : [
          { label: 'YOUR WHY', value: why },
          { label: 'ONE-YEAR GOAL', value: oneYear },
        ];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]}>
      <Reveal>
      <View style={styles.switcher}>
        <Pressable onPress={() => setTab('week')} style={[styles.switchBtn, tab === 'week' && styles.switchBtnActive]}>
          <Text style={[styles.switchText, tab === 'week' && styles.switchTextActive]}>This Week</Text>
        </Pressable>
        <Pressable onPress={() => setTab('month')} style={[styles.switchBtn, tab === 'month' && styles.switchBtnActive]}>
          <Text style={[styles.switchText, tab === 'month' && styles.switchTextActive]}>This Month</Text>
        </Pressable>
      </View>

      <Text style={typography.muted}>{label}</Text>
      <Text style={[typography.title, styles.title]}>{PERIOD_LEVELS[tab].label} ONE Thing</Text>

      <StaircaseContext items={staircaseItems} />

      <PromptEditor
        label={tab}
        question={PERIOD_LEVELS[tab].prompt}
        value={current?.one_thing}
        placeholder="The one thing I'll focus on is..."
        onSave={save}
      />

      {past.length > 0 && (
        <View style={styles.spacedTop}>
          <Text style={typography.label}>PAST {tab.toUpperCase()}S</Text>
          {past.map((p) => (
            <Card key={p.period_key} style={styles.pastCard}>
              <Text style={typography.muted}>
                {tab === 'week' ? weekRangeLabel(p.period_key) : monthLabel(p.period_key)}
              </Text>
              <Text style={typography.body}>{p.one_thing}</Text>
            </Card>
          ))}
        </View>
      )}
      </Reveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  title: { marginBottom: spacing.md },
  spacedTop: { marginTop: spacing.lg, gap: spacing.sm },
  pastCard: { marginTop: spacing.sm },
  switcher: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: 12,
    padding: 3,
    marginBottom: spacing.lg,
  },
  switchBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: 10, alignItems: 'center' },
  switchBtnActive: { backgroundColor: colors.surface },
  switchText: { color: colors.textMuted, fontFamily: fonts.bold },
  switchTextActive: { color: colors.text },
});
