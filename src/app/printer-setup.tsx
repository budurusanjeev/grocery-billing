import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { forgetPrinter, loadPrinter, savePrinter, type PrinterDevice } from '../lib/db';
import { connectPrinter, listPairedPrinters, type IBLEPrinter } from '../lib/printer';
import { cardShadow, colors, isWeb, pressedDim, radius, ripple } from '../lib/theme';
import { confirmDialog, showMessage } from '../lib/ui';

export default function PrinterSetupScreen() {
  const [printer, setPrinter] = useState<PrinterDevice | null>(null);
  const [devices, setDevices] = useState<IBLEPrinter[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    loadPrinter().then(setPrinter);
  }, []);

  const onScan = async () => {
    setScanning(true);
    try {
      const list = await listPairedPrinters();
      setDevices(list);
      setScanned(true);
      if (list.length === 0) {
        showMessage(
          'No paired printers found',
          'Pair your receipt printer with this phone first, in Android Settings → Bluetooth, then come back and scan again.',
        );
      }
    } catch (e: any) {
      showMessage('Could not scan for printers', e?.message ?? 'Something went wrong.');
    } finally {
      setScanning(false);
    }
  };

  const onSelect = async (device: IBLEPrinter) => {
    setConnectingAddress(device.inner_mac_address);
    try {
      await connectPrinter(device.inner_mac_address);
      const saved: PrinterDevice = { name: device.device_name, address: device.inner_mac_address };
      await savePrinter(saved);
      setPrinter(saved);
      showMessage('Printer connected', `"${device.device_name}" is now set as your receipt printer.`);
    } catch (e: any) {
      showMessage('Could not connect', e?.message ?? 'Make sure the printer is turned on and nearby.');
    } finally {
      setConnectingAddress(null);
    }
  };

  const onForget = () => {
    confirmDialog('Forget printer', `Remove "${printer?.name}" as your receipt printer?`, async () => {
      await forgetPrinter();
      setPrinter(null);
    });
  };

  if (isWeb) {
    return (
      <ScreenContainer>
        <View style={styles.screen}>
          <View style={styles.webNotice}>
            <Text style={styles.webNoticeIcon}>🖨</Text>
            <Text style={styles.webNoticeText}>
              Receipt printing works on the Android app only — Bluetooth printers aren't available on
              the web version.
            </Text>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.screen}>
        <Text style={styles.hint}>
          Connect a Bluetooth receipt printer so you can print the final bill at checkout. Pair the
          printer with this phone in Android Settings → Bluetooth first, then scan here.
        </Text>

        {printer && (
          <View style={styles.currentCard}>
            <View style={styles.currentInfo}>
              <Text style={styles.currentLabel}>Current printer</Text>
              <Text style={styles.currentName}>{printer.name}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.forgetBtn, pressed && pressedDim]}
              android_ripple={ripple.onLight}
              onPress={onForget}
            >
              <Text style={styles.forgetBtnText}>Forget</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.scanBtn, pressed && pressedDim]}
          android_ripple={ripple.onDark}
          onPress={onScan}
          disabled={scanning}
        >
          <Text style={styles.scanBtnText}>
            {scanning ? 'Scanning…' : '🔍 Scan for Paired Printers'}
          </Text>
        </Pressable>

        {scanned && devices.length > 0 && (
          <View style={styles.deviceList}>
            <Text style={styles.sectionLabel}>Paired Bluetooth devices</Text>
            {devices.map((d) => {
              const isCurrent = printer?.address === d.inner_mac_address;
              const isConnecting = connectingAddress === d.inner_mac_address;
              return (
                <Pressable
                  key={d.inner_mac_address}
                  style={({ pressed }) => [
                    styles.deviceRow,
                    isCurrent && styles.deviceRowActive,
                    pressed && pressedDim,
                  ]}
                  android_ripple={ripple.onLight}
                  onPress={() => onSelect(d)}
                  disabled={isConnecting}
                >
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{d.device_name || 'Unnamed device'}</Text>
                    <Text style={styles.deviceAddress}>{d.inner_mac_address}</Text>
                  </View>
                  <Text style={styles.deviceStatus}>
                    {isConnecting ? 'Connecting…' : isCurrent ? '✓ Selected' : 'Select'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 12 },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: 12 },
  webNotice: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  webNoticeIcon: { fontSize: 44, marginBottom: 12, opacity: 0.5 },
  webNoticeText: { textAlign: 'center', color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  currentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.brandLight,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 12,
  },
  currentInfo: { flex: 1 },
  currentLabel: { fontSize: 11, fontWeight: '700', color: colors.brand, textTransform: 'uppercase' },
  currentName: { fontSize: 16, fontWeight: '800', color: colors.brandDark, marginTop: 2 },
  forgetBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm, overflow: 'hidden' },
  forgetBtnText: { color: colors.accentRed, fontWeight: '700', fontSize: 13 },
  scanBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    overflow: 'hidden',
    ...cardShadow,
  },
  scanBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  deviceList: { marginTop: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 8 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    ...cardShadow,
  },
  deviceRowActive: { borderColor: colors.brand, backgroundColor: colors.brandLight },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 15, fontWeight: '700', color: colors.text },
  deviceAddress: { fontSize: 12, color: colors.textFaint, marginTop: 2 },
  deviceStatus: { fontSize: 13, fontWeight: '700', color: colors.brand },
});
