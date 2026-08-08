// Imported first, before anything else, so crash/error reporting is live
// for the rest of the app's startup sequence too.
import { Sentry } from '../lib/sentry';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import AuthGate from '../components/AuthGate';
import Header from '../components/Header';
import HeaderBackButton from '../components/HeaderBackButton';
import { maybeAutoUploadBills } from '../lib/sync';
import { colors } from '../lib/theme';
import { AuthProvider } from '../state/auth';
import { BillProvider } from '../state/bill';

function RootLayout() {
  // Opportunistic daily auto-upload of today's bills — checked on first
  // launch and every time the app comes back to the foreground, not a true
  // background task (see maybeAutoUploadBills for why). Runs regardless of
  // auth state; it silently no-ops until the shopkeeper is logged in.
  useEffect(() => {
    maybeAutoUploadBills();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') maybeAutoUploadBills();
    });
    return () => sub.remove();
  }, []);

  return (
    <Sentry.ErrorBoundary fallback={ErrorFallback}>
      <AuthProvider>
        <BillProvider>
          <StatusBar style="light" />
          <AuthGate>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.brand },
                headerTintColor: '#ffffff',
                headerShadowVisible: false,
              }}
            >
              <Stack.Screen
                name="index"
                options={{ headerTitle: () => <Header icon="🛒" title="Gorci" subtitle="Billing" /> }}
              />
              <Stack.Screen
                name="catalog"
                options={{ headerTitle: () => <Header icon="🏷" title="Catalog" subtitle="Prices & items" /> }}
              />
              <Stack.Screen
                name="scan"
                options={{ headerTitle: () => <Header icon="📷" title="Scan List" subtitle="Paper → bill" /> }}
              />
              <Stack.Screen
                name="voice"
                options={{ headerTitle: () => <Header icon="🎤" title="Voice Billing" subtitle="Speak items" /> }}
              />
              <Stack.Screen
                name="history"
                options={{
                  headerTitle: () => <Header icon="📊" title="Today's Bills" subtitle="Day summary" />,
                  headerLeft: () => <HeaderBackButton />,
                }}
              />
              <Stack.Screen
                name="pay"
                options={{ headerTitle: () => <Header icon="💳" title="Payment" subtitle="Collect & confirm" /> }}
              />
              <Stack.Screen
                name="payment-qr"
                options={{ headerTitle: () => <Header icon="📱" title="QR Codes" subtitle="UPI payment codes" /> }}
              />
              <Stack.Screen
                name="printer-setup"
                options={{ headerTitle: () => <Header icon="🖨" title="Receipt Printer" subtitle="Bluetooth setup" /> }}
              />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="forgot-pin" options={{ headerShown: false }} />
              <Stack.Screen name="reset-pin" options={{ headerShown: false }} />
            </Stack>
          </AuthGate>
        </BillProvider>
      </AuthProvider>
    </Sentry.ErrorBoundary>
  );
}

// A friendly fallback instead of a blank/crashed screen if something the
// ErrorBoundary below can catch goes wrong. Bills are saved to local storage
// the moment payment is confirmed (see src/lib/db.ts) — nothing is lost by
// this screen showing up, restarting just re-mounts the app fresh.
function ErrorFallback({ resetError }: { resetError: () => void }) {
  return (
    <View style={styles.crashScreen}>
      <Text style={styles.crashIcon}>⚠️</Text>
      <Text style={styles.crashTitle}>Something went wrong</Text>
      <Text style={styles.crashText}>
        The app hit an unexpected error. Your saved bills are safe — they stay on this device
        regardless of this screen.
      </Text>
      <Pressable style={styles.crashBtn} onPress={resetError}>
        <Text style={styles.crashBtnText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  crashScreen: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  crashIcon: { fontSize: 48, marginBottom: 12 },
  crashTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8 },
  crashText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  crashBtn: { backgroundColor: colors.brand, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32 },
  crashBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
});

// Sentry.wrap adds touch-event breadcrumbs and performance instrumentation
// around the whole app. Safe to call even when no DSN is configured (see
// src/lib/sentry.ts) — it just becomes a harmless passthrough.
export default Sentry.wrap(RootLayout);
