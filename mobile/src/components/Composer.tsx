import { ComponentRef, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEvent,
  View,
} from 'react-native';

import type { Theme } from '@/theme';

interface Props {
  theme: Theme;
  isStreaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

const MIN_INPUT_HEIGHT = 24;
const MAX_INPUT_HEIGHT = 132;

export function Composer({ theme, isStreaming, onSend, onStop }: Props) {
  const [text, setText] = useState('');
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const canSend = text.trim().length > 0 && !isStreaming;

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setText('');
    setInputHeight(MIN_INPUT_HEIGHT);
    // Keep the caret in the field so follow-up questions are one keystroke away.
    inputRef.current?.focus();
  };

  const handleKeyPress = (event: TextInputKeyPressEvent) => {
    // react-native-web forwards the DOM key event; Enter sends, Shift+Enter breaks.
    const { key } = event.nativeEvent;
    const shiftKey = (event.nativeEvent as { shiftKey?: boolean }).shiftKey;
    if (Platform.OS !== 'web' || key !== 'Enter' || shiftKey) return;
    (event as unknown as { preventDefault?: () => void }).preventDefault?.();
    submit();
  };

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.box,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          onKeyPress={handleKeyPress}
          onContentSizeChange={(event) => {
            const height = event.nativeEvent.contentSize.height;
            setInputHeight(Math.min(Math.max(height, MIN_INPUT_HEIGHT), MAX_INPUT_HEIGHT));
          }}
          placeholder="Ask about stock, suppliers or sales…"
          placeholderTextColor={theme.textMuted}
          multiline
          editable={!isStreaming}
          selectionColor={theme.accent}
          accessibilityLabel="Message"
          style={[styles.input, { color: theme.text, height: inputHeight }]}
        />

        <Pressable
          onPress={isStreaming ? onStop : submit}
          disabled={!isStreaming && !canSend}
          accessibilityRole="button"
          accessibilityLabel={isStreaming ? 'Stop generating' : 'Send message'}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: isStreaming || canSend ? theme.accent : theme.surfaceMuted,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          {isStreaming ? (
            <View style={[styles.stopIcon, { backgroundColor: theme.onAccent }]} />
          ) : (
            <Text style={[styles.sendIcon, { color: canSend ? theme.onAccent : theme.textMuted }]}>
              ↑
            </Text>
          )}
        </Pressable>
      </View>

      <Text style={[styles.hint, { color: theme.textMuted }]}>
        {Platform.OS === 'web'
          ? 'Enter to send · Shift+Enter for a new line'
          : 'Replies come from a local model — answers can be wrong.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 12, paddingTop: 8, gap: 6 },
  box: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    paddingTop: Platform.OS === 'ios' ? 6 : 4,
    paddingBottom: 4,
    // Removes the focus ring react-native-web draws on textareas.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { fontSize: 18, fontWeight: '700', lineHeight: 21 },
  stopIcon: { width: 11, height: 11, borderRadius: 2 },
  hint: { fontSize: 11, textAlign: 'center', paddingBottom: 2 },
});
