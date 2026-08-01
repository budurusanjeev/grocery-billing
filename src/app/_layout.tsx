import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AuthGate from '../components/AuthGate';
import Header from '../components/Header';
import HeaderBackButton from '../components/HeaderBackButton';
import { colors } from '../lib/theme';
import { AuthProvider } from '../state/auth';
import { BillProvider } from '../state/bill';

export default function RootLayout() {
  return (
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
              options={{ headerTitle: () => <Header icon="🛒" title="Kirana Bill" subtitle="Billing" /> }}
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
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="forgot-pin" options={{ headerShown: false }} />
            <Stack.Screen name="reset-pin" options={{ headerShown: false }} />
          </Stack>
        </AuthGate>
      </BillProvider>
    </AuthProvider>
  );
}
