import { useCallback, useRef, useState } from 'react';

import {
  ChatMessage,
  describeError,
  isAbortError,
  sendChatMessage,
} from '@/api/chat';

let messageCounter = 0;
function nextId(): string {
  messageCounter += 1;
  return `m${messageCounter}`;
}

export interface UseChatResult {
  messages: ChatMessage[];
  isStreaming: boolean;
  canRetry: boolean;
  send: (text: string) => void;
  stop: () => void;
  retry: () => void;
  reset: () => void;
}

export function useChat(): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef(false);

  const run = useCallback(async (history: ChatMessage[]) => {
    const assistantId = nextId();
    setMessages([...history, { id: assistantId, role: 'assistant', content: '' }]);
    setIsStreaming(true);
    streamingRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;
    let received = '';

    const update = (patch: Partial<ChatMessage>) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId ? { ...message, ...patch } : message,
        ),
      );
    };

    try {
      await sendChatMessage({
        messages: history,
        signal: controller.signal,
        onDelta: (delta) => {
          received += delta;
          update({ content: received });
        },
      });
      if (!received) {
        update({ content: 'The model returned an empty reply.', failed: true });
      }
    } catch (error) {
      if (isAbortError(error)) {
        if (!received) {
          setMessages((current) => current.filter((message) => message.id !== assistantId));
        }
      } else {
        const message = describeError(error);
        update({
          content: received ? `${received}\n\n${message}` : message,
          failed: true,
        });
      }
    } finally {
      setIsStreaming(false);
      streamingRef.current = false;
      abortRef.current = null;
    }
  }, []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streamingRef.current) return;
      const history: ChatMessage[] = [
        ...messages.filter((message) => !message.failed),
        { id: nextId(), role: 'user', content: trimmed },
      ];
      void run(history);
    },
    [messages, run],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const canRetry = !isStreaming && messages.some((message) => message.failed);

  const retry = useCallback(() => {
    if (streamingRef.current) return;
    const lastUserIndex = [...messages]
      .map((message, index) => ({ message, index }))
      .reverse()
      .find(({ message }) => message.role === 'user')?.index;
    if (lastUserIndex === undefined) return;
    void run(messages.slice(0, lastUserIndex + 1).filter((message) => !message.failed));
  }, [messages, run]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, []);

  return { messages, isStreaming, canRetry, send, stop, retry, reset };
}
