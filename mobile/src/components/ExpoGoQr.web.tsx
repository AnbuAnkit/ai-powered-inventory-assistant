import Constants from 'expo-constants';
import QRCode from 'react-qr-code';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

const configuredUrl = process.env.EXPO_PUBLIC_EXPO_GO_URL?.trim();
const hostUri =
  Constants.expoConfig?.hostUri ??
  (
    Constants as unknown as {
      expoGoConfig?: { debuggerHost?: string };
    }
  ).expoGoConfig?.debuggerHost;
const browserHost =
  process.env.NODE_ENV === 'development' &&
  typeof window !== 'undefined' &&
  !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
    ? window.location.host
    : null;
const expoGoHost = hostUri || browserHost;
const expoGoUrl =
  configuredUrl ||
  (expoGoHost
    ? `exp://${expoGoHost.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`
    : null);

export function ExpoGoQr() {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Show QR code to open in Expo Go"
        style={({ pressed }) => [
          styles.button,
          {
            borderColor: theme.border,
            backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
          },
        ]}
      >
        <Text style={[styles.buttonLabel, { color: theme.text }]}>Open on phone</Text>
      </Pressable>

      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close QR code"
          />
          <View
            style={[
              styles.dialog,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.title, { color: theme.text }]}>Open in Expo Go</Text>
            {expoGoUrl ? (
              <View style={styles.qrFrame}>
                <QRCode value={expoGoUrl} size={220} />
              </View>
            ) : (
              <Text style={[styles.instructions, { color: theme.textMuted }]}>
                Open this web app using your computer&apos;s LAN address while the
                Expo server is running, or configure EXPO_PUBLIC_EXPO_GO_URL.
              </Text>
            )}
            <Text style={[styles.instructions, { color: theme.textMuted }]}>
              Scan this code using the Expo Go app. Keep the development server running.
            </Text>
            {expoGoUrl && (
              <Text
                selectable
                style={[styles.url, { color: theme.textMuted }]}
                numberOfLines={2}
              >
                {expoGoUrl}
              </Text>
            )}
            <Pressable
              onPress={() => setVisible(false)}
              accessibilityRole="button"
              style={[styles.closeButton, { backgroundColor: theme.accent }]}
            >
              <Text style={[styles.closeLabel, { color: theme.onAccent }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 36,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
  },
  buttonLabel: { fontSize: 13, fontWeight: '600' },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  dialog: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 14,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
  },
  title: { fontSize: 20, fontWeight: '700' },
  qrFrame: { backgroundColor: '#ffffff', padding: 12, borderRadius: 12 },
  instructions: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  url: { fontSize: 12, textAlign: 'center' },
  closeButton: {
    minWidth: 100,
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  closeLabel: { fontSize: 14, fontWeight: '600' },
});
