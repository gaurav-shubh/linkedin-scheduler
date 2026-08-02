import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Button from './Button';
import { colors, elevation, fonts, radius, spacing } from '../theme';

/**
 * The goal staircase as an interactive stepper: one card, every level a step on the
 * dot-and-rail, and only one question open at a time. Collapsed steps show their
 * answer (or "Tap to set"); tapping a step expands its editor in place.
 */
export default function GoalStepper({ levels, values, onSave }) {
  // Open the first unanswered level by default so a new user lands mid-flow.
  const firstUnset = levels.find((l) => !values[l.key])?.key ?? null;
  const [openKey, setOpenKey] = useState(firstUnset);
  const [draft, setDraft] = useState('');

  const toggle = (key) => {
    if (openKey === key) {
      setOpenKey(null);
      return;
    }
    setDraft(values[key] || '');
    setOpenKey(key);
  };

  const save = async (key) => {
    await onSave(key, draft.trim());
    setOpenKey(null);
  };

  return (
    <View style={[styles.card, elevation.card]}>
      {levels.map((level, i) => {
        const value = values[level.key] || '';
        const open = openKey === level.key;
        const last = i === levels.length - 1;
        return (
          <View key={level.key} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, value ? styles.dotSet : null, open && styles.dotOpen]} />
              {!last && <View style={styles.line} />}
            </View>

            <View style={[styles.content, !last && styles.contentGap]}>
              <Pressable onPress={() => toggle(level.key)} accessibilityRole="button">
                <Text style={styles.label}>{level.label.toUpperCase()}</Text>
                {!open &&
                  (value ? (
                    <Text style={styles.value} numberOfLines={2}>
                      {value}
                    </Text>
                  ) : (
                    <Text style={styles.unset}>Tap to set</Text>
                  ))}
              </Pressable>

              {open && (
                <View style={styles.editor}>
                  <Text style={styles.question}>{level.prompt}</Text>
                  <TextInput
                    style={styles.input}
                    multiline
                    autoFocus
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Type your answer..."
                    placeholderTextColor="#9AA3AD"
                  />
                  <View style={styles.actions}>
                    <Button
                      title="Cancel"
                      variant="ghost"
                      onPress={() => setOpenKey(null)}
                      style={styles.actionBtn}
                    />
                    <Button
                      title="Save"
                      onPress={() => save(level.key)}
                      disabled={!draft.trim()}
                      style={styles.actionBtn}
                    />
                  </View>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  row: { flexDirection: 'row' },
  rail: { width: 22, alignItems: 'center' },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    marginTop: 3,
  },
  dotSet: { backgroundColor: colors.success, borderColor: colors.success },
  dotOpen: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 3 },
  content: { flex: 1, marginLeft: spacing.sm },
  contentGap: { paddingBottom: spacing.lg },
  label: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  value: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.text, marginTop: 2 },
  unset: { fontFamily: fonts.bold, fontSize: 14, color: colors.accent, marginTop: 2 },
  editor: { marginTop: spacing.sm },
  question: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  input: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    minHeight: 76,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: { paddingHorizontal: spacing.md },
});
