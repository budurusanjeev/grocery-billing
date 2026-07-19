import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BillProvider } from '../state/bill';

export default function RootLayout() {
  return (
    <BillProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#166534' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Kirana Bill' }} />
        <Stack.Screen name="catalog" options={{ title: 'Catalog & Prices' }} />
        <Stack.Screen name="scan" options={{ title: 'Scan Paper List' }} />
        <Stack.Screen name="voice" options={{ title: 'Voice Billing' }} />
      </Stack>
    </BillProvider>
  );
}
