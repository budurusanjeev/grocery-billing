import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { forgetPrinter, getDeviceLabel, loadPrinter, savePrinter, setDeviceLabel, type PrinterDevice } from '../lib/db';
import { listPairedPrinters, scanNetworkPrinters, testConnectPrinter } from '../lib/printer';
import { cardShadow, colors, isWeb, pressedDim, radius, ripple } from '../lib/theme';
import { confirmDialog, showMessage } from '../lib/ui';

// A key that uniquely identifies a scanned device, used for React keys and
// for comparing against the currently-saved printer.
function deviceKey(d: PrinterDevice): string {
  return d.type === 'bluetooth' ? `ble:${d.address}` : `net:${d.host}:${d.port}`;
}

export default function PrinterSetupScreen() {
  const [printer, setPrinter] = useState<PrinterDevice | null>(null);
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [scanningBluetooth, setScanningBluetooth] = useState(false);
  const [scanningNetwork, setScanningNetwork] = useState(false);
  const [connectingKey, setConnectingKey] = useState<string | null>(null);
  const [deviceLabel, setDeviceLabelState] = useState('');
  const [savedLabel, setSavedLabel] = useState('');

  useEffect(() => {
    loadPrinter().then(setPrinter);
    getDeviceLabel().then((label) => {
      setDeviceLabelState(label);
      setSavedLabel(label);
    });
  }, []);

  const onSaveDeviceLabel = async () => {
    await setDeviceLabel(deviceLabel);
    setSavedLabel(deviceLabel.trim());
    showMessage(
      'Saved',
      deviceLabel.trim()
        ? `Bill numbers on this device will now end in "-${deviceLabel.trim()}".`
        : 'Bill numbers on this device will no longer have a suffix.',
    );
  };

  const deviceLabelSection = (
    <View style={styles.deviceLabelCard}>
      <Text style={styles.sectionLabel}>This device's name (for bill numbers)</Text>
      <Text style={styles.deviceLabelHint}>
        Only needed if this shop bills from more than one device (e.g. a PC and phones) — gives each
        one's bill numbers a distinct suffix so they never clash, like 2604001-PC vs 2604001-Phone1.
        Leave blank if this is the only device.
      </Text>
      <View style={styles.deviceLabelRow}>
        <TextInput
          style={styles.deviceLabelInput}
          placeholder="e.g. PC, Phone1, Counter2"
          placeholderTextColor={colors.textFaint}
          value={deviceLabel}
          onChangeText={setDeviceLabelState}
          autoCapitalize="none"
        />
        <Pressable
          style={({ pressed }) => [
            styles.deviceLabelSaveBtn,
            deviceLabel.trim() === savedLabel && styles.deviceLabelSaveBtnDisabled,
            pressed && pressedDim,
          ]}
          android_ripple={ripple.onDark}
          onPress={onSaveDeviceLabel}
          disabled={deviceLabel.trim() === savedLabel}
        >
          <Text style={styles.deviceLabelSaveBtnText}>Save</Text>
        </Pressable>
      </View>
    </View>
  );

  const onScanBluetooth = async () => {
    setScanningBluetooth(true);
    try {
      const list = await listPairedPrinters();
      const found: PrinterDevice[] = list.map((d) => ({
        type: 'bluetooth',
        name: d.device_name || 'Unnamed device',
        address: d.inner_mac_address,
      }));
      setDevices((prev) => [...prev.filter((d) => d.type !== 'bluetooth'), ...found]);
      if (found.length === 0) {
        showMessage(
          'No paired printers found',
          'Pair your receipt printer with this phone first, in Android Settings → Bluetooth, then scan again.',
        );
      }
    } catch (e: any) {
      showMessage('Could not scan for Bluetooth printers', e?.message ?? 'Something went wrong.');
    } finally {
      setScanningBluetooth(false);
    }
  };

  const onScanNetwork = async () => {
    setScanningNetwork(true);
    try {
      const list = await scanNetworkPrinters();
      const found: PrinterDevice[] = list.map((d) => ({
        type: 'network',
        name: `Printer at ${d.host}`,
        host: d.host,
        port: d.port,
      }));
      setDevices((prev) => [...prev.filter((d) => d.type !== 'network'), ...found]);
      if (found.length === 0) {
        showMessage(
          'No WiFi printers found',
          'Make sure the printer and this phone are on the same WiFi network and the printer is turned on, then scan again.',
        );
      }
    } catch (e: any) {
      showMessage('Could not scan for WiFi printers', e?.message ?? 'Something went wrong.');
    } finally {
      setScanningNetwork(false);
    }
  };

  const onSelect = async (device: PrinterDevice) => {
    setConnectingKey(deviceKey(device));
    try {
      await testConnectPrinter(device);
      await savePrinter(device);
      setPrinter(device);
      showMessage('Printer connected', `"${device.name}" is now set as your receipt printer.`);
    } catch (e: any) {
      showMessage('Could not connect', e?.message ?? 'Make sure the printer is turned on and nearby.');
    } finally {
      setConnectingKey(null);
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
          {deviceLabelSection}
          <View style={styles.webNotice}>
            <Text style={styles.webNoticeIcon}>🖨</Text>
            <Text style={styles.webNoticeText}>
              Receipt printing works on the Android app only — Bluetooth/network printers aren't
              available on the web version.
            </Text>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  const isCurrent = (d: PrinterDevice) => printer && deviceKey(printer) === deviceKey(d);

  return (
    <ScreenContainer>
      <View style={styles.screen}>
        {deviceLabelSection}

        <Text style={styles.hint}>
          Connect a receipt printer — Bluetooth (pair it with this phone in Android Settings →
          Bluetooth first) or a WiFi printer on the same network as this phone.
        </Text>

        {printer && (
          <View style={styles.currentCard}>
            <View style={styles.currentInfo}>
              <Text style={styles.currentLabel}>Current printer</Text>
              <Text style={styles.currentName}>
                {printer.type === 'bluetooth' ? '🔵 ' : '🌐 '}
                {printer.name}
              </Text>
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

        <View style={styles.scanRow}>
          <Pressable
            style={({ pressed }) => [styles.scanBtn, pressed && pressedDim]}
            android_ripple={ripple.onDark}
            onPress={onScanBluetooth}
            disabled={scanningBluetooth}
          >
            <Text style={styles.scanBtnText}>
              {scanningBluetooth ? 'Scanning…' : '🔵 Scan Bluetooth'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.scanBtn, styles.scanBtnNetwork, pressed && pressedDim]}
            android_ripple={ripple.onDark}
            onPress={onScanNetwork}
            disabled={scanningNetwork}
          >
            <Text style={styles.scanBtnText}>{scanningNetwork ? 'Scanning…' : '🌐 Scan WiFi'}</Text>
          </Pressable>
        </View>
        {scanningNetwork && (
          <Text style={styles.scanningHint}>Scanning the WiFi network — this can take up to 30 seconds…</Text>
        )}

        {devices.length > 0 && (
          <View style={styles.deviceList}>
            <Text style={styles.sectionLabel}>Found printers</Text>
            {devices.map((d) => {
              const key = deviceKey(d);
              const connecting = connectingKey === key;
              return (
                <Pressable
                  key={key}
                  style={({ pressed }) => [
                    styles.deviceRow,
                    isCurrent(d) && styles.deviceRowActive,
                    pressed && pressedDim,
                  ]}
                  android_ripple={ripple.onLight}
                  onPress={() => onSelect(d)}
                  disabled={connecting}
                >
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>
                      {d.type === 'bluetooth' ? '🔵 ' : '🌐 '}
                      {d.name}
                    </Text>
                    <Text style={styles.deviceAddress}>
                      {d.type === 'bluetooth' ? d.address : `${d.host}:${d.port}`}
                    </Text>
                  </View>
                  <Text style={styles.deviceStatus}>
                    {connecting ? 'Connecting…' : isCurrent(d) ? '✓ Selected' : 'Select'}
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
  deviceLabelCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 16,
    ...cardShadow,
  },
  deviceLabelHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginTop: 4, marginBottom: 10 },
  deviceLabelRow: { flexDirection: 'row', gap: 8 },
  deviceLabelInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  deviceLabelSaveBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.sm,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  deviceLabelSaveBtnDisabled: { backgroundColor: colors.border },
  deviceLabelSaveBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
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
  scanRow: { flexDirection: 'row', gap: 8 },
  scanBtn: {
    flex: 1,
    backgroundColor: colors.accentBlue,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    overflow: 'hidden',
    ...cardShadow,
  },
  scanBtnNetwork: { backgroundColor: colors.accentPurple },
  scanBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  scanningHint: { fontSize: 12, color: colors.textMuted, marginTop: 8, textAlign: 'center' },
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
