import { useColorScheme } from 'react-native';

export type Theme = {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  bubble: string;
  danger: string;
  online: string;
};

const light: Theme = {
  background: '#f7f7f8',
  surface: '#ffffff',
  surfaceMuted: '#eef0f3',
  border: '#e3e5ea',
  text: '#111827',
  textMuted: '#6b7280',
  accent: '#2563eb',
  onAccent: '#ffffff',
  bubble: '#2563eb',
  danger: '#b91c1c',
  online: '#16a34a',
};

const dark: Theme = {
  background: '#0f1115',
  surface: '#171a21',
  surfaceMuted: '#212734',
  border: '#262b36',
  text: '#f3f4f6',
  textMuted: '#9ca3af',
  accent: '#3b82f6',
  onAccent: '#ffffff',
  bubble: '#2563eb',
  danger: '#f87171',
  online: '#4ade80',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const layout = {
  /** ChatGPT-style centred column, comfortable on tablets and desktop web. */
  maxContentWidth: 820,
};
