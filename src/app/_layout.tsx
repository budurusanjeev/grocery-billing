import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Header from '../components/Header';
import { colors } from '../lib/theme';
import { BillProvider } from '../state/bill';

export default function RootLayout() {
  return (
    <BillProvider>
      <StatusBar style="light" />
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
      </Stack>
    </BillProvider>
  );
}
