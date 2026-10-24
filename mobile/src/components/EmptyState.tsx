import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Theme } from '@/theme';

interface Props {
  theme: Theme;
  onPick: (prompt: string) => void;
}

const SUGGESTIONS = [
  'Which products are low on stock?',
  "Summarise this week's sales trends.",
  'Draft a reorder plan for my top sellers.',
];

export function EmptyState({ theme, onPick }: Props) {
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badge,
          { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.badgeLabel, { color: theme.textMuted }]}>AI</Text>
      </View>

      <Text style={[styles.title, { color: theme.text }]}>How can I help with your inventory?</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>
        Ask about stock levels, suppliers, reorder points or sales. The model is accessed
        through Google's Gemini API.
      </Text>

      <View style={styles.suggestions}>
        {SUGGESTIONS.map((suggestion) => (
          <Pressable
            key={suggestion}
            onPress={() => onPick(suggestion)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.chip,
              {
                borderColor: theme.border,
                backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
              },
            ]}
          >
            <Text style={[styles.chipLabel, { color: theme.text }]}>{suggestion}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  badgeLabel: { fontSize: 14, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', maxWidth: 420 },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 460,
  },
  suggestions: { marginTop: 24, width: '100%', maxWidth: 460, gap: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipLabel: { fontSize: 14 },
});
