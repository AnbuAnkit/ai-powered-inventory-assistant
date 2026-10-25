import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

export default function LandingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={[styles.mark, { backgroundColor: theme.surfaceMuted }]}>
          <Text style={[styles.markLabel, { color: theme.accent }]}>KE</Text>
        </View>
        <Text style={[styles.title, { color: theme.text }]}>Kavya Enterprise</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Your AI-powered inventory assistant
        </Text>

        <Pressable
          onPress={() => router.push('/chat')}
          accessibilityRole="button"
          accessibilityLabel="Chat now"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.buttonLabel, { color: theme.onAccent }]}>chat now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  content: { width: '100%', maxWidth: 480, alignItems: 'center' },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  markLabel: { fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 32, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', marginTop: 10 },
  button: {
    minWidth: 180,
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 15,
    marginTop: 32,
  },
  buttonLabel: { fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
});
