import Constants from 'expo-constants';
import { fetch as expoFetch } from 'expo/fetch';
import { Platform } from 'react-native';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** True when this message ends in an error we want to style differently. */
  failed?: boolean;
}

export interface HealthReport {
  model: string;
}

const CONFIGURED_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');

/**
 * Where the Python API lives.
 *
 * - Web dev server and the API both run on this machine.
 * - On a phone, Metro's host IP is reachable over Wi-Fi, so the API is too
 *   (same machine, port 8000). This is what makes testing on a real device work
 *   without editing code.
 * - The Android emulator reaches the host through 10.0.2.2.
 * - EXPO_PUBLIC_API_URL overrides everything (needed for production builds).
 */
function resolveApiBaseUrl(): string {
  if (CONFIGURED_URL) return CONFIGURED_URL;
  if (Platform.OS === 'web') return 'http://localhost:8000';

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig
      ?.debuggerHost;
  const host = typeof hostUri === 'string' ? hostUri.split(':')[0] : undefined;
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:8000`;
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}

export const API_BASE_URL = resolveApiBaseUrl();

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Raised when the runtime cannot read a response body incrementally. */
class StreamingUnsupportedError extends Error {}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || /abort/i.test(error.message));
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) {
    if (/network request failed|failed to fetch|networkerror|econnrefused/i.test(error.message)) {
      return `Can't reach the API at ${API_BASE_URL}. Start the backend with \`uv run inventory-api\`.`;
    }
    return error.message;
  }
  return 'Something went wrong while talking to the model.';
}

function toRequestMessages(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.content.trim().length > 0 && !message.failed)
    .map((message) => ({ role: message.role, content: message.content }));
}

async function toApiError(response: Response): Promise<ApiError> {
  let detail = '';
  try {
    const body: unknown = await response.json();
    const record = body as { detail?: unknown; error?: unknown };
    if (typeof record.detail === 'string') {
      detail = record.detail;
    } else if (Array.isArray(record.detail)) {
      detail = record.detail
        .map((item) => (item as { msg?: string })?.msg)
        .filter(Boolean)
        .join('; ');
    } else if (typeof record.error === 'string') {
      detail = record.error;
    }
  } catch {
    // Non-JSON error body; fall through to the status message.
  }
  return new ApiError(
    detail || `The API responded with status ${response.status}.`,
    response.status,
  );
}

interface SendOptions {
  messages: ChatMessage[];
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
}

/**
 * Send the conversation and stream the reply token by token.
 *
 * The backend owns the API key and talks to Google's Gemini API, so the client
 * only ever sees text deltas over SSE. If the runtime cannot stream response bodies we
 * fall back to the buffered endpoint so a reply still arrives.
 */
export async function sendChatMessage({
  messages,
  signal,
  onDelta,
}: SendOptions): Promise<string> {
  const payload = { messages: toRequestMessages(messages) };
  try {
    return await streamReply(payload, onDelta, signal);
  } catch (error) {
    if (error instanceof StreamingUnsupportedError) {
      return bufferedReply(payload, onDelta, signal);
    }
    throw error;
  }
}

async function streamReply(
  payload: { messages: { role: ChatRole; content: string }[] },
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const response = await expoFetch(`${API_BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) throw await toApiError(response);

  const body = response.body;
  if (!body || typeof body.getReader !== 'function') {
    throw new StreamingUnsupportedError('Streaming bodies are unavailable.');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let reply = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });

    let boundary = pending.indexOf('\n\n');
    while (boundary !== -1) {
      const rawEvent = pending.slice(0, boundary);
      pending = pending.slice(boundary + 2);
      boundary = pending.indexOf('\n\n');

      const data = rawEvent
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('');
      if (!data) continue;

      const event = JSON.parse(data) as {
        type: 'delta' | 'done' | 'error';
        text?: string;
        message?: string;
      };

      if (event.type === 'delta' && event.text) {
        reply += event.text;
        onDelta(event.text);
      } else if (event.type === 'done' && !reply && event.text) {
        reply = event.text;
        onDelta(event.text);
      } else if (event.type === 'error') {
        throw new ApiError(event.message ?? 'The model could not answer.');
      }
    }
  }

  return reply;
}

async function bufferedReply(
  payload: { messages: { role: ChatRole; content: string }[] },
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const response = await expoFetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) throw await toApiError(response);

  const data = (await response.json()) as {
    ok: boolean;
    reply?: string;
    error?: string;
  };
  if (!data.ok || typeof data.reply !== 'string') {
    throw new ApiError(data.error ?? 'The model returned an empty reply.');
  }
  onDelta(data.reply);
  return data.reply;
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthReport> {
  const response = await expoFetch(`${API_BASE_URL}/api/health`, { signal });
  if (!response.ok) throw await toApiError(response);
  const data = (await response.json()) as {
    model: string;
  };
  return {
    model: data.model,
  };
}
