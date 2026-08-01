import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { addQrCode, loadQrCodes, MAX_QRCODES, removeQrCode, type QrCode } from '../lib/db';
import { deleteQrCodeRemote, syncQrCodes } from '../lib/sync';
import { cardShadow, colors, pressedDim, radius, ripple } from '../lib/theme';
import { confirmDialog, showMessage } from '../lib/ui';

export default function PaymentQrScreen() {
  const [qrCodes, setQrCodes] = useState<QrCode[]>([]);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadQrCodes().then(setQrCodes);
  }, []);

  const onSync = async () => {
    setSyncing(true);
    try {
      const { added, items } = await syncQrCodes();
      setQrCodes(items);
      showMessage(
        'Sync complete',
        added > 0
          ? `Pulled ${added} QR code(s) saved on another device.`
          : 'Everything is already up to date.',
      );
    } catch (e: any) {
      showMessage('Sync failed', e?.message ?? 'Could not reach the server.');
    } finally {
      setSyncing(false);
    }
  };

  const pick = async (useCamera: boolean) => {
    if (qrCodes.length >= MAX_QRCODES) {
      showMessage('Limit reached', `You can save up to ${MAX_QRCODES} QR codes.`);
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      base64: true,
      quality: 0.7,
    };
    const result = useCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    setPendingImage(`data:${mimeType};base64,${asset.base64}`);
  };

  const onSave = async () => {
    if (!pendingImage) return;
    if (!label.trim()) {
      showMessage('Missing label', 'Give this QR code a name (e.g. "GPay", "SBI Bank").');
      return;
    }
    setSaving(true);
    try {
      const next = await addQrCode({ label: label.trim(), imageUri: pendingImage });
      setQrCodes(next);
      setPendingImage(null);
      setLabel('');
    } catch (e: any) {
      showMessage('Could not save', e?.message ?? 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (qr: QrCode) => {
    confirmDialog('Remove QR code', `Remove "${qr.label}"?`, async () => {
      const next = await removeQrCode(qr.id);
      setQrCodes(next);
      deleteQrCodeRemote(qr.id);
    });
  };

  return (
    <ScreenContainer>
      <View style={styles.screen}>
        <Text style={styles.hint}>
          Save up to {MAX_QRCODES} UPI QR codes (GPay, PhonePe, bank, etc.) so you can quickly show
          the right one at checkout. ({qrCodes.length}/{MAX_QRCODES})
        </Text>

        <Pressable
          style={({ pressed }) => [styles.syncBtn, pressed && pressedDim]}
          android_ripple={ripple.onDark}
          onPress={onSync}
          disabled={syncing}
        >
          <Text style={styles.syncBtnText}>
            {syncing ? 'Syncing…' : '☁ Sync QR Codes (across devices)'}
          </Text>
        </Pressable>

        {!pendingImage ? (
          <View style={styles.pickRow}>
            {Platform.OS !== 'web' && (
              <Pressable
                style={({ pressed }) => [styles.pickBtn, pressed && pressedDim]}
                android_ripple={ripple.onDark}
                onPress={() => pick(true)}
              >
                <Text style={styles.pickBtnText}>📷 Camera</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [styles.pickBtn, pressed && pressedDim]}
              android_ripple={ripple.onDark}
              onPress={() => pick(false)}
            >
              <Text style={styles.pickBtnText}>🖼 Choose Photo</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.pendingForm}>
            <Image source={{ uri: pendingImage }} style={styles.pendingImage} resizeMode="contain" />
            <TextInput
              style={styles.input}
              placeholder='Label (e.g. "GPay", "PhonePe", "SBI Bank")'
              placeholderTextColor={colors.textFaint}
              value={label}
              onChangeText={setLabel}
            />
            <View style={styles.row}>
              <Pressable
                style={({ pressed }) => [styles.cancelBtn, pressed && pressedDim]}
                android_ripple={ripple.onLight}
                onPress={() => {
                  setPendingImage(null);
                  setLabel('');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.saveBtn, pressed && pressedDim]}
                android_ripple={ripple.onDark}
                onPress={onSave}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save QR Code'}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.grid}>
          {qrCodes.map((qr) => (
            <View key={qr.id} style={styles.card}>
              <Image source={{ uri: qr.imageUri }} style={styles.thumb} resizeMode="contain" />
              <Text style={styles.cardLabel} numberOfLines={1}>
                {qr.label}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.deleteBtn, pressed && pressedDim]}
                android_ripple={ripple.onLight}
                onPress={() => onDelete(qr)}
              >
                <Text style={styles.deleteBtnText}>Remove</Text>
              </Pressable>
            </View>
          ))}
          {qrCodes.length === 0 && (
            <Text style={styles.empty}>No QR codes saved yet.</Text>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 12 },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: 10 },
  syncBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden',
    ...cardShadow,
  },
  syncBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  pickRow: { flexDirection: 'row', gap: 8 },
  pickBtn: {
    flex: 1,
    backgroundColor: colors.accentBlue,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    overflow: 'hidden',
    ...cardShadow,
  },
  pickBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  pendingForm: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    gap: 8,
    ...cardShadow,
  },
  pendingImage: { width: '100%', height: 180, backgroundColor: colors.bg, borderRadius: radius.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  row: { flexDirection: 'row', gap: 8 },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
  cancelBtnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  saveBtn: {
    flex: 1,
    backgroundColor: '#16a34a',
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
  saveBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  card: {
    width: '31%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 8,
    alignItems: 'center',
    ...cardShadow,
  },
  thumb: { width: '100%', height: 90, backgroundColor: colors.bg, borderRadius: radius.sm },
  cardLabel: { fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 6 },
  deleteBtn: { marginTop: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: radius.sm, overflow: 'hidden' },
  deleteBtnText: { fontSize: 11, color: colors.accentRed, fontWeight: '700' },
  empty: { color: colors.textFaint, fontSize: 14, textAlign: 'center', width: '100%', marginTop: 20 },
});