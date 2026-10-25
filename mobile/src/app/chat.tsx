import { useCallback, useEffect, useRef } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ChatMessage } from '@/api/chat';
import { ChatHeader } from '@/components/ChatHeader';
import { Composer } from '@/components/Composer';
import { EmptyState } from '@/components/EmptyState';
import { MessageBubble } from '@/components/MessageBubble';
import { useBackendStatus } from '@/hooks/useBackendStatus';
import { useChat } from '@/hooks/useChat';
import { layout, useTheme } from '@/theme';

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const backend = useBackendStatus();
  const { messages, isStreaming, canRetry, send, stop, retry, reset } = useChat();

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const hasMessages = messages.length > 0;

  const scrollToEnd = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  useEffect(() => {
    if (hasMessages) scrollToEnd();
  }, [hasMessages, scrollToEnd]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.column,
          Platform.OS === 'web' && {
            borderLeftWidth: StyleSheet.hairlineWidth,
            borderRightWidth: StyleSheet.hairlineWidth,
            borderColor: theme.border,
            maxWidth: layout.maxContentWidth,
          },
        ]}
      >
        <View style={{ paddingTop: insets.top }}>
          <ChatHeader
            theme={theme}
            model={backend.model}
            connection={backend.state}
            onNewChat={reset}
            newChatDisabled={!hasMessages || isStreaming}
          />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(message) => message.id}
            renderItem={({ item }) => (
              <MessageBubble message={item} theme={theme} isStreaming={isStreaming} />
            )}
            ListEmptyComponent={<EmptyState theme={theme} onPick={send} />}
            contentContainerStyle={[
              styles.listContent,
              { justifyContent: hasMessages ? 'flex-end' : 'center' },
            ]}
            onContentSizeChange={() => hasMessages && scrollToEnd()}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
          />

          {canRetry && (
            <View style={styles.retryRow}>
              <Pressable
                onPress={retry}
                accessibilityRole="button"
                accessibilityLabel="Retry the last message"
                style={({ pressed }) => [
                  styles.retryButton,
                  {
                    borderColor: theme.border,
                    backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
                  },
                ]}
              >
                <Text style={[styles.retryLabel, { color: theme.text }]}>↻ Retry</Text>
              </Pressable>
            </View>
          )}

          <View style={{ paddingBottom: Math.max(insets.bottom, 10) }}>
            <Composer
              theme={theme}
              isStreaming={isStreaming}
              onSend={send}
              onStop={stop}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center' },
  column: { flex: 1, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 16,
  },
  retryRow: { alignItems: 'center', paddingBottom: 4 },
  retryButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  retryLabel: { fontSize: 13, fontWeight: '600' },
});
