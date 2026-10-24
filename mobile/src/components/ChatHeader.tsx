import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ExpoGoQr } from '@/components/ExpoGoQr';
import type { Theme } from '@/theme';

interface Props {
  theme: Theme;
  model: string | null;
  connection: 'checking' | 'online' | 'offline';
  onNewChat: () => void;
  newChatDisabled: boolean;
}

const STATUS_LABEL: Record<Props['connection'], string> = {
  checking: 'connecting…',
  online: 'ready',
  offline: 'backend offline',
};

export function ChatHeader({ theme, model, connection, onNewChat, newChatDisabled }: Props) {
  const dotColor =
    connection === 'online' ? theme.online : connection === 'offline' ? theme.danger : theme.textMuted;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <View style={styles.titles}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          Inventory Assistant
        </Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={1}>
            {model ? `${model} · ${STATUS_LABEL[connection]}` : STATUS_LABEL[connection]}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <ExpoGoQr />
        <Pressable
          onPress={onNewChat}
          disabled={newChatDisabled}
          accessibilityRole="button"
          accessibilityLabel="Start a new chat"
          style={({ pressed }) => [
            styles.newChat,
            {
              borderColor: theme.border,
              backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
              opacity: newChatDisabled ? 0.5 : 1,
            },
          ]}
        >
          <Text style={[styles.newChatLabel, { color: theme.text }]}>+ New chat</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titles: { flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  subtitle: { fontSize: 12 },
  newChat: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  newChatLabel: { fontSize: 13, fontWeight: '600' },
});
