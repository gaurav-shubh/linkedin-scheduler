import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

// Small breadcrumb of the goal staircase above a prompt, so the answer stays aligned upward.
export default function StaircaseContext({ items }) {
  const filled = items.filter((i) => i.value);
  if (!filled.length) return null;
  return (
    <View style={styles.wrap}>
      {filled.map((item, i) => (
        <View key={item.label} style={styles.item}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.value} numberOfLines={2}>{item.value}</Text>
          {i < filled.length - 1 && <Text style={styles.arrow}>↓</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  item: { marginBottom: 2 },
  label: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  value: { fontSize: 14, color: colors.text, marginBottom: 2 },
  arrow: { fontSize: 12, color: colors.border, marginBottom: 2 },
});
