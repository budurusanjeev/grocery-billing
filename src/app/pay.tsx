import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { loadQrCodes, saveBill, type PaymentMethod, type QrCode } from '../lib/db';
import { cardShadow, colors, isWeb, pressedDim, radius, raisedShadow, ripple } from '../lib/theme';
import { formatMoney, showMessage } from '../lib/ui';
import { useBill } from '../state/bill';

const METHODS: { key: PaymentMethod; label: string; icon: string }[] = [
  { key: 'cash', label: 'Cash', icon: '💵' },
  { key: 'upi', label: 'UPI', icon: '📱' },
  { key: 'card', label: 'Card', icon: '💳' },
];

export default function PayScreen() {
  const router = useRouter();
  const { lines, customerType, subtotal, discountRate, discount, total, clear } = useBill();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [qrCodes, setQrCodes] = useState<QrCode[]>([]);
  const [selectedQr, setSelectedQr] = useState<QrCode | null>(null);
  const [saving, setSaving] = useState(false);
  const [paidText, setPaidText] = useState<string | null>(null);
  // total comes live from useBill() and recalculates to 0 the instant
  // clear() runs — capture the amount that was actually paid before
  // clearing, so the success screen doesn't show ₹0.
  const [paidAmount, setPaidAmount] = useState(0);

  useEffect(() => {
    if (method === 'upi') {
      loadQrCodes().then(setQrCodes);
    } else {
      setSelectedQr(null);
    }
  }, [method]);

  const finish = async () => {
    if (lines.length === 0) {
      showMessage('Empty bill', 'Nothing to pay for.');
      return;
    }
    if (!method) {
      showMessage('Choose a payment method', 'Select Cash, UPI, or Card first.');
      return;
    }
    setSaving(true);
    try {
      await saveBill(lines, total, method, customerType, discount);
      const methodLabel = METHODS.find((m) => m.key === method)?.label ?? method;
      const text = [
        'Kirana Bill',
        ...lines.map(
          (l) => `${l.name} — ${l.qty} ${l.unit} × ${formatMoney(l.price)} = ${formatMoney(l.price * l.qty)}`,
        ),
        ...(discount > 0
          ? [
              `Subtotal: ${formatMoney(subtotal)}`,
              `Discount (${customerType}, ${discountRate}%): −${formatMoney(discount)}`,
            ]
          : []),
        `Total: ${formatMoney(total)}`,
        `Paid via: ${methodLabel}`,
      ].join('\n');
      setPaidAmount(total);
      clear();
      // Sharing is optional — show a dedicated button instead of forcing a
      // decision via a popup right after payment.
      setPaidText(text);
    } finally {
      setSaving(false);
    }
  };

  const onShareWhatsApp = () => {
    if (!paidText) return;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(paidText)}`);
  };

  const onDone = () => router.replace('/');

  if (paidText) {
    return (
      <ScreenContainer>
        <View style={styles.screen}>
          <View style={styles.successBox}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>Payment Recorded</Text>
            <Text style={styles.successAmount}>{formatMoney(paidAmount)}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && pressedDim]}
            android_ripple={ripple.onDark}
            onPress={onShareWhatsApp}
          >
            <Text style={styles.shareBtnText}>📤 Share on WhatsApp</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.doneBtn, pressed && pressedDim]}
            android_ripple={ripple.onLight}
            onPress={onDone}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const totalBarEl = (
    <View style={styles.totalBar}>
      <View>
        <Text style={styles.totalLabel}>Amount Due</Text>
        {discount > 0 && (
          <Text style={styles.discountHint}>
            {formatMoney(subtotal)} − {discountRate}% = −{formatMoney(discount)}
          </Text>
        )}
      </View>
      <Text style={styles.totalValue}>{formatMoney(total)}</Text>
    </View>
  );

  const methodRowEl = (
    <>
      <Text style={styles.sectionLabel}>How is the customer paying?</Text>
      <View style={styles.methodRow}>
        {METHODS.map((m) => (
          <Pressable
            key={m.key}
            style={({ pressed }) => [
              styles.methodChip,
              method === m.key && styles.methodChipActive,
              pressed && pressedDim,
            ]}
            android_ripple={ripple.onLight}
            onPress={() => setMethod(m.key)}
          >
            <Text style={styles.methodIcon}>{m.icon}</Text>
            <Text style={[styles.methodLabel, method === m.key && styles.methodLabelActive]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );

  // On web the selected QR is shown full-size in its own panel facing the
  // customer (see the isWeb branch below) — this section then only needs a
  // compact confirmation instead of duplicating the same big image. On
  // mobile there's no second panel to show it in, so it stays inline here.
  const qrSectionEl = method === 'upi' && (
    <View style={styles.upiSection}>
      {qrCodes.length > 0 && (
        <Pressable
          style={({ pressed }) => [styles.manageQrBtn, pressed && pressedDim]}
          android_ripple={ripple.onLight}
          onPress={() => router.push('/payment-qr')}
        >
          <Text style={styles.manageQrBtnText}>⚙ Manage QR Codes</Text>
        </Pressable>
      )}
      {qrCodes.length === 0 ? (
        <View style={styles.noQr}>
          <Text style={styles.noQrText}>No QR codes saved yet.</Text>
          <Pressable
            style={({ pressed }) => [styles.addQrBtn, pressed && pressedDim]}
            android_ripple={ripple.onDark}
            onPress={() => router.push('/payment-qr')}
          >
            <Text style={styles.addQrBtnText}>+ Add a QR Code</Text>
          </Pressable>
        </View>
      ) : selectedQr ? (
        isWeb ? (
          <View style={styles.qrConfirm}>
            <Text style={styles.qrConfirmText}>✓ “{selectedQr.label}” is showing on the left for the customer to scan</Text>
            <Pressable
              style={({ pressed }) => [styles.changeQrBtn, pressed && pressedDim]}
              android_ripple={ripple.onLight}
              onPress={() => setSelectedQr(null)}
            >
              <Text style={styles.changeQrBtnText}>Choose a different QR code</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.qrDisplay}>
            <Text style={styles.qrDisplayLabel}>{selectedQr.label}</Text>
            <Image source={{ uri: selectedQr.imageUri }} style={styles.qrImage} resizeMode="contain" />
            <Pressable
              style={({ pressed }) => [styles.changeQrBtn, pressed && pressedDim]}
              android_ripple={ripple.onLight}
              onPress={() => setSelectedQr(null)}
            >
              <Text style={styles.changeQrBtnText}>Choose a different QR code</Text>
            </Pressable>
          </View>
        )
      ) : (
        <>
          <Text style={styles.sectionLabel}>Pick which QR code to show</Text>
          <View style={styles.qrGrid}>
            {qrCodes.map((qr) => (
              <Pressable
                key={qr.id}
                style={({ pressed }) => [styles.qrCard, pressed && pressedDim]}
                android_ripple={ripple.onLight}
                onPress={() => setSelectedQr(qr)}
              >
                <Image source={{ uri: qr.imageUri }} style={styles.qrThumb} resizeMode="contain" />
                <Text style={styles.qrCardLabel} numberOfLines={1}>
                  {qr.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );

  const footerEl = (
    <View style={styles.footer}>
      <Pressable
        style={({ pressed }) => [styles.cancelBtn, pressed && pressedDim]}
        android_ripple={ripple.onLight}
        onPress={() => router.back()}
      >
        <Text style={styles.cancelBtnText}>Cancel</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.confirmBtn, pressed && pressedDim]}
        android_ripple={ripple.onDark}
        onPress={finish}
        disabled={saving}
      >
        <Text style={styles.confirmBtnText}>{saving ? 'Saving…' : '✓ Confirm Payment'}</Text>
      </Pressable>
    </View>
  );

  if (isWeb) {
    // Two panels: the left one is meant to face the customer, showing the
    // selected QR code full-size so they can scan it directly off the
    // screen; the shopkeeper operates the right panel exactly as before
    // (method selection, QR picker, Cancel/Confirm).
    return (
      <View style={styles.page}>
        <View style={styles.qrPanel}>
          {method === 'upi' && selectedQr ? (
            <>
              <Text style={styles.qrPanelLabel}>{selectedQr.label}</Text>
              <Image source={{ uri: selectedQr.imageUri }} style={styles.qrPanelImage} resizeMode="contain" />
              <Text style={styles.qrPanelHint}>Scan to pay {formatMoney(total)}</Text>
            </>
          ) : (
            <View style={styles.qrPanelEmptyBox}>
              <Text style={styles.qrPanelEmptyIcon}>📱</Text>
              <Text style={styles.qrPanelEmptyText}>
                {method === 'upi'
                  ? 'Pick a QR code on the right — it will appear here full-size for the customer to scan.'
                  : 'Select UPI as the payment method to show a scannable QR code here.'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.controlsPanel}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {totalBarEl}
            {methodRowEl}
            {qrSectionEl}
          </ScrollView>
          {footerEl}
        </View>
      </View>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.screen}>
        {/* Scrollable — the QR image + everything above/below it can add up
            to more height than the viewport, and this used to have no way
            to scroll, trapping the "choose a different QR code" button and
            the footer (Cancel/Confirm) off-screen with no way to reach them. */}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {totalBarEl}
          {methodRowEl}
          {qrSectionEl}
        </ScrollView>
        {footerEl}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 12 },
  // Web-only two-panel layout: a customer-facing QR panel on the left, the
  // shopkeeper's controls (unchanged) on the right — mirrors the two-panel
  // pattern used on the Billing and Voice screens.
  page: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.bg,
    padding: 12,
    gap: 12,
  },
  qrPanel: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...raisedShadow,
  },
  qrPanelLabel: { fontSize: 20, fontWeight: '800', color: colors.brandDark, marginBottom: 16 },
  qrPanelImage: { width: '90%', maxWidth: 420, height: 420 },
  qrPanelHint: { marginTop: 16, fontSize: 16, fontWeight: '700', color: colors.text },
  qrPanelEmptyBox: { alignItems: 'center', paddingHorizontal: 30 },
  qrPanelEmptyIcon: { fontSize: 48, marginBottom: 12, opacity: 0.4 },
  qrPanelEmptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  controlsPanel: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    ...raisedShadow,
  },
  qrConfirm: {
    backgroundColor: colors.brandLight,
    borderRadius: radius.lg,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  qrConfirmText: { color: colors.brandDark, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  successBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  successIcon: {
    fontSize: 48,
    color: '#ffffff',
    backgroundColor: '#16a34a',
    width: 84,
    height: 84,
    borderRadius: 42,
    textAlign: 'center',
    lineHeight: 84,
    overflow: 'hidden',
    marginBottom: 8,
  },
  successTitle: { fontSize: 20, fontWeight: '800', color: colors.brandDark },
  successAmount: { fontSize: 32, fontWeight: '800', color: colors.text },
  shareBtn: {
    backgroundColor: '#25D366',
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    overflow: 'hidden',
    ...cardShadow,
  },
  shareBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
  doneBtn: {
    backgroundColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    overflow: 'hidden',
  },
  doneBtnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 16,
    ...cardShadow,
  },
  totalLabel: { color: colors.brandLight, fontSize: 15, fontWeight: '600' },
  totalValue: { color: '#ffffff', fontSize: 30, fontWeight: '800' },
  discountHint: { color: colors.brandLight, fontSize: 12, marginTop: 2 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginTop: 16, marginBottom: 8 },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodChip: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    ...cardShadow,
  },
  methodChipActive: { backgroundColor: colors.brandLight, borderColor: colors.brand },
  methodIcon: { fontSize: 24, marginBottom: 4 },
  methodLabel: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  methodLabelActive: { color: colors.brandDark },
  upiSection: { marginTop: 4 },
  manageQrBtn: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 4, overflow: 'hidden' },
  manageQrBtnText: { color: colors.accentBlue, fontSize: 13, fontWeight: '700' },
  noQr: { alignItems: 'center', paddingVertical: 16, gap: 10 },
  noQrText: { color: colors.textMuted, fontSize: 14 },
  addQrBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  addQrBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  qrGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  qrCard: {
    width: '31%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 8,
    alignItems: 'center',
    overflow: 'hidden',
    ...cardShadow,
  },
  qrThumb: { width: '100%', height: 80, backgroundColor: colors.bg, borderRadius: radius.sm },
  qrCardLabel: { fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 6 },
  qrDisplay: { alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, ...cardShadow },
  qrDisplayLabel: { fontSize: 16, fontWeight: '800', color: colors.brandDark, marginBottom: 10 },
  qrImage: { width: '100%', height: 260 },
  changeQrBtn: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm, overflow: 'hidden' },
  changeQrBtnText: { color: colors.brand, fontSize: 13, fontWeight: '600' },
  footer: { flexDirection: 'row', gap: 8, paddingTop: 16 },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    overflow: 'hidden',
  },
  cancelBtnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  confirmBtn: {
    flex: 2,
    backgroundColor: '#16a34a',
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    overflow: 'hidden',
    ...cardShadow,
  },
  confirmBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
});