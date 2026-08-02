import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Card from './Card';
import Button from './Button';
import { colors, spacing, typography } from '../theme';

export default function PromptEditor({ label, question, value, placeholder, onSave, extra }) {
  const [draft, setDraft] = useState(value || '');
  const [editing, setEditing] = useState(!value);

  useEffect(() => {
    setDraft(value || '');
    setEditing(!value);
  }, [value]);

  const save = async () => {
    await onSave(draft.trim());
    setEditing(false);
  };

  return (
    <Card>
      <Text style={typography.label}>{label.toUpperCase()}</Text>
      <Text style={[typography.muted, styles.question]}>{question}</Text>
      {editing ? (
        <>
          <TextInput
            style={styles.input}
            multiline
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            placeholderTextColor="#999"
            autoFocus
          />
          <View style={styles.row}>
            {!!value && (
              <Button title="Cancel" variant="secondary" onPress={() => { setDraft(value); setEditing(false); }} style={styles.flex} />
            )}
            <Button title="Save" onPress={save} disabled={!draft.trim()} style={styles.flex} />
          </View>
        </>
      ) : (
        <>
          <Text style={[typography.body, styles.answer]} onPress={() => setEditing(true)}>{value}</Text>
          {extra}
          <Text style={styles.editLink} onPress={() => setEditing(true)}>Edit</Text>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  question: { marginTop: spacing.xs, fontStyle: 'italic' },
  input: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    minHeight: 70,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
  answer: { marginTop: spacing.sm },
  editLink: { color: colors.accent, marginTop: spacing.sm, fontWeight: '600' },
});
