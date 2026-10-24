import { StyleSheet, Text, View } from 'react-native';

import type { ChatMessage } from '@/api/chat';
import type { Theme } from '@/theme';
import { TypingDots } from './TypingDots';

interface Props {
  message: ChatMessage;
  theme: Theme;
  isStreaming: boolean;
}

export function MessageBubble({ message, theme, isStreaming }: Props) {
  if (message.role === 'user') {
    return (
      <View style={styles.userRow}>
        <View style={[styles.userBubble, { backgroundColor: theme.bubble }]}>
          <Text selectable style={[styles.body, { color: theme.onAccent }]}>
            {message.content}
          </Text>
        </View>
      </View>
    );
  }

  const showDots = isStreaming && message.content.length === 0;

  return (
    <View style={styles.assistantRow}>
      <View
        style={[
          styles.avatar,
          { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.avatarLabel, { color: theme.textMuted }]}>AI</Text>
      </View>

      <View style={styles.assistantBody}>
        {showDots ? (
          <TypingDots color={theme.textMuted} />
        ) : (
          <Text
            selectable
            style={[styles.body, { color: message.failed ? theme.danger : theme.text }]}
          >
            {message.content}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: { alignItems: 'flex-end' },
  userBubble: {
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomRightRadius: 6,
  },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  avatarLabel: { fontSize: 10, fontWeight: '700' },
  assistantBody: { flex: 1, paddingTop: 2 },
  body: { fontSize: 15, lineHeight: 22 },
});
