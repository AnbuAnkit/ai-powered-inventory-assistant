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

const theme: Theme = {
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceMuted: '#eff6ff',
  border: '#dbeafe',
  text: '#0f172a',
  textMuted: '#64748b',
  accent: '#2563eb',
  onAccent: '#ffffff',
  bubble: '#2563eb',
  danger: '#b91c1c',
  online: '#16a34a',
};

export function useTheme(): Theme {
  return theme;
}

export const layout = {
  /** ChatGPT-style centred column, comfortable on tablets and desktop web. */
  maxContentWidth: 820,
};
