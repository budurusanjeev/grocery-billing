import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { loadPrinter, loadQrCodes, saveBill, type Bill, type PaymentMethod, type QrCode } from '../lib/db';
import { printBillReceipt, printBillSystemDialog } from '../lib/printer';
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
  const [showFullQr, setShowFullQr] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printingSystem, setPrintingSystem] = useState(false);
  // total comes live from useBill() and recalculates to 0 the instant
  // clear() runs — capture the amount that was actually paid before
  // clearing, so the success screen doesn't show ₹0.
  const [paidAmount, setPaidAmount] = useState(0);
  const [paidBill, setPaidBill] = useState<Bill | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');

  useEffect(() => {
    if (method === 'upi') {
      loadQrCodes().then(setQrCodes);
    } else {
      setSelectedQr(null);
    }
  }, [method]);

  const finish = async () => {
    // Function-level guard, not just the button's disabled prop — a fast
    // double-tap/double-click can fire onPress twice before React re-renders
    // the disabled state, which would otherwise save the same sale as two
    // separate bills.
    if (saving) return;
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
      const bill = await saveBill(lines, total, {
        paymentMethod: method,
        customerType,
        discount,
        customerName,
        customerMobile,
      });
      setPaidBill(bill);
      const methodLabel = METHODS.find((m) => m.key === method)?.label ?? method;
      const text = [
        `Groci${bill.billNumber ? ` #${bill.billNumber}` : ''}`,
        ...(bill.customerName ? [`Customer: ${bill.customerName}`] : []),
        ...(bill.customerMobile ? [`Mobile: ${bill.customerMobile}`] : []),
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
      setCustomerName('');
      setCustomerMobile('');
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

  const onPrint = async () => {
    if (!paidBill) return;
    const printer = await loadPrinter();
    if (!printer) {
      showMessage('No printer set up', 'Go to Receipt Printer Setup to connect a printer first.');
      return;
    }
    setPrinting(true);
    try {
      await printBillReceipt(printer, paidBill, 'Groci');
    } catch (e: any) {
      showMessage('Could not print', e?.message ?? 'Make sure the printer is turned on and nearby.');
    } finally {
      setPrinting(false);
    }
  };

  const onPrintSystem = async () => {
    if (!paidBill) return;
    setPrintingSystem(true);
    try {
      await printBillSystemDialog(paidBill, 'Groci');
    } catch (e: any) {
      showMessage('Could not print', e?.message ?? 'Something went wrong opening the print dialog.');
    } finally {
      setPrintingSystem(false);
    }
  };

  const onDone = () => router.replace('/');

  if (paidText) {
    return (
      <ScreenContainer>
        <View style={styles.screen}>
          <View style={styles.successBox}>
            <Image source={require('../../assets/images/icon.png')} style={styles.brandLogo} />
            <Text style={styles.brandName}>Groci</Text>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>Payment Recorded</Text>
            <Text style={styles.successAmount}>{formatMoney(paidAmount)}</Text>
            {paidBill?.billNumber && <Text style={styles.successBillNumber}>Bill #{paidBill.billNumber}</Text>}
          </View>

          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && pressedDim]}
            android_ripple={ripple.onDark}
            onPress={onShareWhatsApp}
          >
            <Text style={styles.shareBtnText}>📤 Share on WhatsApp</Text>
          </Pressable>

          {!isWeb && (
            <Pressable
              style={({ pressed }) => [styles.printBtn, pressed && pressedDim]}
              android_ripple={ripple.onLight}
              onPress={onPrint}
              disabled={printing}
            >
              <Text style={styles.printBtnText}>{printing ? 'Printing…' : '🖨 Print Receipt'}</Text>
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [styles.printSystemBtn, pressed && pressedDim]}
            android_ripple={ripple.onLight}
            onPress={onPrintSystem}
            disabled={printingSystem}
          >
            <Text style={styles.printSystemBtnText}>
              {printingSystem ? 'Opening print dialog…' : '🖶 Print (WiFi / Any Printer)'}
            </Text>
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

  const customerFieldsEl = (
    <View style={styles.customerFields}>
      <Text style={styles.sectionLabel}>Customer details (optional)</Text>
      <View style={styles.customerRow}>
        <TextInput
          style={[styles.customerInput, styles.customerInputName]}
          placeholder="Name"
          placeholderTextColor={colors.textFaint}
          value={customerName}
          onChangeText={setCustomerName}
        />
        <TextInput
          style={[styles.customerInput, styles.customerInputMobile]}
          placeholder="Mobile number"
          placeholderTextColor={colors.textFaint}
          keyboardType="phone-pad"
          value={customerMobile}
          onChangeText={setCustomerMobile}
        />
      </View>
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
      <Pressable
        style={({ pressed }) => [styles.printerSetupLink, pressed && pressedDim]}
        android_ripple={ripple.onLight}
        onPress={() => router.push('/printer-setup')}
      >
        <Text style={styles.printerSetupLinkText}>
          {isWeb ? '🖨 Receipt Printer / Device Name Setup' : '🖨 Receipt Printer Setup'}
        </Text>
      </Pressable>
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
            <Text style={styles.qrConfirmText}>✓ “{selectedQr.label}” is showing on the right for the customer to scan</Text>
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
            {/* The Image is a plain sibling here, NOT wrapped inside a
                Pressable — on this device/RN version, an Image nested
                directly inside a Pressable rendered completely blank
                (loaded fine per onLoad, just never painted). Tapping the
                QR code still works via a separate, absolutely-positioned
                transparent Pressable layered on top of it instead. */}
            <View style={styles.qrImageWrap}>
              <Image source={{ uri: selectedQr.imageUri }} style={styles.qrImage} resizeMode="contain" />
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowFullQr(true)} />
            </View>
            <Pressable onPress={() => setShowFullQr(true)}>
              <Text style={styles.tapToEnlargeHint}>⤢ Show full screen</Text>
            </Pressable>
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
                onPress={() => {
                  console.log('VIEW QR: selected', qr.label, 'len=', qr.imageUri.length);
                  setSelectedQr(qr);
                }}
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

  // Full-screen, opaque white background — no dimmed/blurred overlay — so
  // the QR code stays crisp and bright enough for the customer's phone
  // camera to scan easily. Shared between the web and mobile layouts below.
  const fullQrModal = selectedQr && (
    <Modal visible={showFullQr} animationType="fade" onRequestClose={() => setShowFullQr(false)}>
      {/* Image is a plain sibling here, NOT nested inside the Pressable
          below — nesting an Image directly inside a Pressable rendered
          completely blank on-device (loaded fine per onLoad, just never
          painted). The Pressable is an absolutely-positioned transparent
          overlay on top instead, which still catches a tap anywhere on
          the screen to close, without wrapping the Image itself. */}
      <View style={styles.fullQrScreen}>
        <Text style={styles.fullQrLabel}>{selectedQr.label}</Text>
        <Image source={{ uri: selectedQr.imageUri }} style={styles.fullQrImage} resizeMode="contain" />
        <Text style={styles.fullQrHint}>Tap anywhere to close</Text>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowFullQr(false)} />
        <Pressable
          style={({ pressed }) => [styles.fullQrCloseBtn, pressed && pressedDim]}
          android_ripple={ripple.onLight}
          onPress={() => setShowFullQr(false)}
        >
          <Text style={styles.fullQrCloseBtnText}>✕</Text>
        </Pressable>
      </View>
    </Modal>
  );

  if (isWeb) {
    // Two panels: the shopkeeper operates the left panel as usual (method
    // selection, QR picker, Cancel/Confirm); the right panel faces the
    // customer, showing the selected QR code full-size so they can scan it
    // directly off the screen.
    return (
      <View style={styles.page}>
        <View style={styles.controlsPanel}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {totalBarEl}
            {customerFieldsEl}
            {methodRowEl}
            {qrSectionEl}
          </ScrollView>
          {footerEl}
        </View>

        <View style={styles.qrPanel}>
          {/* Scrollable — a 420px QR image plus label/hint can be taller
              than the panel on shorter screens, which was compressing the
              hint text against the bottom edge with no way to scroll to it. */}
          <ScrollView style={styles.qrPanelScroll} contentContainerStyle={styles.qrPanelScrollContent}>
            {method === 'upi' && selectedQr ? (
              <>
                <Text style={styles.qrPanelLabel}>{selectedQr.label}</Text>
                <View style={styles.qrImageWrap}>
                  <Image source={{ uri: selectedQr.imageUri }} style={styles.qrPanelImage} resizeMode="contain" />
                  <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowFullQr(true)} />
                </View>
                <Text style={styles.qrPanelHint}>Scan to pay {formatMoney(total)}</Text>
              </>
            ) : (
              <View style={styles.qrPanelEmptyBox}>
                <Text style={styles.qrPanelEmptyIcon}>📱</Text>
                <Text style={styles.qrPanelEmptyText}>
                  {method === 'upi'
                    ? 'Pick a QR code on the left — it will appear here full-size for the customer to scan.'
                    : 'Select UPI as the payment method to show a scannable QR code here.'}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
        {fullQrModal}
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
          {customerFieldsEl}
          {methodRowEl}
          {qrSectionEl}
        </ScrollView>
        {footerEl}
      </View>
      {fullQrModal}
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
    ...raisedShadow,
  },
  qrPanelScroll: { flex: 1 },
  qrPanelScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
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
  brandLogo: { width: 56, height: 56, marginBottom: -4 },
  brandName: { fontSize: 18, fontWeight: '800', color: colors.brandDark, marginBottom: 8 },
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
  successBillNumber: { fontSize: 13, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  shareBtn: {
    backgroundColor: '#25D366',
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    overflow: 'hidden',
    ...cardShadow,
  },
  shareBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
  printBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    overflow: 'hidden',
    ...cardShadow,
  },
  printBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
  printSystemBtn: {
    backgroundColor: colors.accentAmber,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    overflow: 'hidden',
    ...cardShadow,
  },
  printSystemBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
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
  customerFields: { marginTop: 4 },
  customerRow: { flexDirection: 'row', gap: 8 },
  customerInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  customerInputName: { flex: 1 },
  customerInputMobile: { flex: 1 },
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
  printerSetupLink: { alignSelf: 'flex-start', paddingVertical: 8, borderRadius: radius.sm, overflow: 'hidden' },
  printerSetupLinkText: { color: colors.accentBlue, fontSize: 13, fontWeight: '600' },
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
  qrImageWrap: { width: '100%' },
  qrImage: { width: '100%', height: 260 },
  tapToEnlargeHint: { marginTop: 8, fontSize: 12, color: colors.textMuted },
  changeQrBtn: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm, overflow: 'hidden' },
  changeQrBtnText: { color: colors.brand, fontSize: 13, fontWeight: '600' },
  // Plain opaque white, no dim/blur overlay — the whole point is a crisp,
  // bright, easy-to-scan QR code filling the screen.
  fullQrScreen: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fullQrLabel: { fontSize: 20, fontWeight: '800', color: colors.brandDark, marginBottom: 20 },
  // aspectRatio + a percentage width, not a percentage height — Image
  // doesn't reliably resolve a percentage height on its own the way a plain
  // View does, which was rendering as a blank/zero-size box.
  fullQrImage: { width: '85%', maxWidth: 420, aspectRatio: 1 },
  fullQrHint: { marginTop: 24, fontSize: 14, color: colors.textMuted },
  fullQrCloseBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fullQrCloseBtnText: { fontSize: 18, fontWeight: '700', color: colors.text },
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