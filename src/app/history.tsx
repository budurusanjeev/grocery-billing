import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getBills, loadPrinter, type Bill } from '../lib/db';
import { requireInternet } from '../lib/network';
import { printBillReceipt, printBillSystemDialog } from '../lib/printer';
import { getLastUploadAt, uploadBills } from '../lib/sync';
import { cardShadow, colors, isWeb, pressedDim, radius, raisedShadow, ripple, spacing } from '../lib/theme';
import { formatMoney, showMessage } from '../lib/ui';

const PAYMENT_ICON: Record<string, string> = { cash: '💵', upi: '📱', card: '💳' };
const CUSTOMER_LABEL: Record<string, string> = { regular: 'Regular', retailer: 'Retailer', wholesaler: 'Wholesaler' };

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isSameDay(isoDate: string, day: Date): boolean {
  const d = new Date(isoDate);
  return (
    d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate()
  );
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function HistoryScreen() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [printingSystemId, setPrintingSystemId] = useState<string | null>(null);
  const [lastUploadAt, setLastUploadAt] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    getBills().then(setBills);
    getLastUploadAt().then(setLastUploadAt);
  }, []);

  const isToday = dayKey(selectedDate) === dayKey(startOfDay(new Date()));

  // Distinct days that actually have a bill, newest first — lets the picker
  // jump straight to a day instead of tapping ◀ repeatedly through empty
  // days, and only ever lists real options.
  const availableDays = useMemo(() => {
    const byKey = new Map<string, { date: Date; count: number }>();
    for (const b of bills) {
      const d = startOfDay(new Date(b.created_at));
      const key = dayKey(d);
      const existing = byKey.get(key);
      byKey.set(key, { date: d, count: (existing?.count ?? 0) + 1 });
    }
    return [...byKey.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [bills]);

  const goToPreviousDay = () => {
    const prev = availableDays.find((d) => d.date.getTime() < selectedDate.getTime());
    if (prev) setSelectedDate(prev.date);
  };

  const goToNextDay = () => {
    const candidates = availableDays.filter((d) => d.date.getTime() > selectedDate.getTime());
    if (candidates.length > 0) {
      setSelectedDate(candidates[candidates.length - 1].date);
    } else if (!isToday) {
      setSelectedDate(startOfDay(new Date()));
    }
  };

  const hasPreviousDay = availableDays.some((d) => d.date.getTime() < selectedDate.getTime());
  const hasNextDay = !isToday;

  const daysSinceUpload = useMemo(() => {
    if (!lastUploadAt) return null;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfUploadDay = new Date(lastUploadAt);
    startOfUploadDay.setHours(0, 0, 0, 0);
    return Math.round((startOfToday.getTime() - startOfUploadDay.getTime()) / (24 * 60 * 60 * 1000));
  }, [lastUploadAt]);

  const dayBills = useMemo(() => bills.filter((b) => isSameDay(b.created_at, selectedDate)), [bills, selectedDate]);
  const totalRevenue = useMemo(() => dayBills.reduce((sum, b) => sum + b.total, 0), [dayBills]);
  const totalItems = useMemo(
    () => dayBills.reduce((sum, b) => sum + b.lines.reduce((n, l) => n + l.qty, 0), 0),
    [dayBills],
  );

  const shareDaySummary = () => {
    const dateLabel = selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const text = [
      `Kirana Bill — Day Summary (${dateLabel})`,
      `Bills: ${dayBills.length}`,
      `Total sales: ${formatMoney(totalRevenue)}`,
    ].join('\n');
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  const onUploadAll = async () => {
    if (!(await requireInternet())) return;
    setUploading(true);
    try {
      const { uploaded } = await uploadBills();
      setLastUploadAt(new Date());
      showMessage(
        'Upload complete',
        uploaded > 0 ? `Uploaded ${uploaded} payment(s) to the server.` : 'No payments to upload.',
      );
    } catch (e: any) {
      showMessage('Upload failed', e?.message ?? 'Could not reach the server.');
    } finally {
      setUploading(false);
    }
  };

  const shareBill = (bill: Bill) => {
    const time = new Date(bill.created_at).toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const text = [
      `Kirana Bill${bill.billNumber ? ` #${bill.billNumber}` : ''} — ${time}`,
      ...(bill.customerName ? [`Customer: ${bill.customerName}`] : []),
      ...(bill.customerMobile ? [`Mobile: ${bill.customerMobile}`] : []),
      ...bill.lines.map(
        (l) => `${l.name} — ${l.qty} ${l.unit} × ${formatMoney(l.price)} = ${formatMoney(l.price * l.qty)}`,
      ),
      ...(bill.discount
        ? [`Discount (${CUSTOMER_LABEL[bill.customerType ?? 'regular']}): −${formatMoney(bill.discount)}`]
        : []),
      `Total: ${formatMoney(bill.total)}`,
    ].join('\n');
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  const printBill = async (bill: Bill) => {
    const printer = await loadPrinter();
    if (!printer) {
      showMessage('No printer set up', 'Go to Payment → Receipt Printer Setup to connect one first.');
      return;
    }
    setPrintingId(bill.id);
    try {
      await printBillReceipt(printer, bill, 'Kirana Bill');
    } catch (e: any) {
      showMessage('Could not print', e?.message ?? 'Make sure the printer is turned on and nearby.');
    } finally {
      setPrintingId(null);
    }
  };

  const printBillSystem = async (bill: Bill) => {
    setPrintingSystemId(bill.id);
    try {
      await printBillSystemDialog(bill, 'Kirana Bill');
    } catch (e: any) {
      showMessage('Could not print', e?.message ?? 'Something went wrong opening the print dialog.');
    } finally {
      setPrintingSystemId(null);
    }
  };

  const controlsEl = (
    <>
      <View style={styles.dateNavRow}>
        <Pressable
          style={({ pressed }) => [styles.dateNavBtn, !hasPreviousDay && styles.dateNavBtnDisabled, pressed && pressedDim]}
          android_ripple={ripple.onLight}
          onPress={goToPreviousDay}
          disabled={!hasPreviousDay}
        >
          <Text style={styles.dateNavBtnText}>◀</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.dateLabelBtn, pressed && pressedDim]}
          android_ripple={ripple.onLight}
          onPress={() => setPickerOpen(true)}
        >
          <Text style={styles.dateLabelText}>
            {isToday
              ? 'Today'
              : selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
          <Text style={styles.dateLabelHint}>📅 change</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.dateNavBtn, !hasNextDay && styles.dateNavBtnDisabled, pressed && pressedDim]}
          android_ripple={ripple.onLight}
          onPress={goToNextDay}
          disabled={!hasNextDay}
        >
          <Text style={styles.dateNavBtnText}>▶</Text>
        </Pressable>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryValue}>{dayBills.length}</Text>
          <Text style={styles.summaryLabel}>Bills</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryStat}>
          <Text style={styles.summaryValue}>{totalItems}</Text>
          <Text style={styles.summaryLabel}>Items sold</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryStat}>
          <Text style={styles.summaryValue}>{formatMoney(totalRevenue)}</Text>
          <Text style={styles.summaryLabel}>Total sales</Text>
        </View>
      </View>

      {dayBills.length > 0 && (
        <Pressable
          style={({ pressed }) => [styles.shareBtn, pressed && pressedDim]}
          android_ripple={ripple.onDark}
          onPress={shareDaySummary}
        >
          <Text style={styles.shareBtnText}>📤 Share Day Summary on WhatsApp</Text>
        </Pressable>
      )}

      {(daysSinceUpload === null || daysSinceUpload > 0) && (
        <Text style={styles.uploadWarning}>
          ⚠{' '}
          {daysSinceUpload === null
            ? 'Never uploaded to the server yet'
            : `Not uploaded in ${daysSinceUpload} day${daysSinceUpload > 1 ? 's' : ''}`}
        </Text>
      )}

      <Pressable
        style={({ pressed }) => [styles.uploadBtn, pressed && pressedDim]}
        android_ripple={ripple.onDark}
        onPress={onUploadAll}
        disabled={uploading}
      >
        <Text style={styles.uploadBtnText}>
          {uploading ? 'Uploading…' : '☁ Upload All Payments to Server'}
        </Text>
      </Pressable>
    </>
  );

  const billListEl = (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={dayBills}
          keyExtractor={(b) => b.id}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🧾</Text>
              <Text style={styles.empty}>{isToday ? 'No bills saved yet today.' : 'No bills on this day.'}</Text>
            </View>
          }
          renderItem={({ item: bill }) => {
            const isOpen = expandedId === bill.id;
            const time = new Date(bill.created_at).toLocaleTimeString('en-IN', {
              hour: 'numeric',
              minute: '2-digit',
            });
            return (
              <Pressable
                style={({ pressed }) => [styles.billCard, pressed && pressedDim]}
                android_ripple={ripple.onLight}
                onPress={() => setExpandedId(isOpen ? null : bill.id)}
              >
                <View style={styles.billRow}>
                  <View>
                    <Text style={styles.billTime}>
                      {bill.billNumber ? `#${bill.billNumber} · ` : ''}
                      {time}
                      {bill.customerName ? ` · ${bill.customerName}` : ''}
                    </Text>
                    <Text style={styles.billMeta}>
                      {bill.lines.length} items
                      {bill.paymentMethod ? ` · ${PAYMENT_ICON[bill.paymentMethod] ?? ''} ${bill.paymentMethod.toUpperCase()}` : ''}
                      {bill.customerType && bill.customerType !== 'regular'
                        ? ` · ${CUSTOMER_LABEL[bill.customerType]}`
                        : ''}
                    </Text>
                  </View>
                  <Text style={styles.billTotal}>{formatMoney(bill.total)}</Text>
                </View>
                {isOpen && (
                  <View style={styles.billDetail}>
                    {bill.lines.map((l) => (
                      <View key={l.itemId} style={styles.billLine}>
                        <Text style={styles.billLineName}>
                          {l.name} · {l.qty} {l.unit}
                        </Text>
                        <Text style={styles.billLineAmount}>{formatMoney(l.price * l.qty)}</Text>
                      </View>
                    ))}
                    {!!bill.discount && (
                      <View style={styles.billLine}>
                        <Text style={styles.billLineName}>
                          Discount ({CUSTOMER_LABEL[bill.customerType ?? 'regular']})
                        </Text>
                        <Text style={styles.billLineAmount}>−{formatMoney(bill.discount)}</Text>
                      </View>
                    )}
                    <Pressable
                      style={({ pressed }) => [styles.billShareBtn, pressed && pressedDim]}
                      android_ripple={ripple.onDark}
                      onPress={() => shareBill(bill)}
                    >
                      <Text style={styles.billShareBtnText}>📤 Share this bill on WhatsApp</Text>
                    </Pressable>
                    {!isWeb && (
                      <Pressable
                        style={({ pressed }) => [styles.billPrintBtn, pressed && pressedDim]}
                        android_ripple={ripple.onLight}
                        onPress={() => printBill(bill)}
                        disabled={printingId === bill.id}
                      >
                        <Text style={styles.billPrintBtnText}>
                          {printingId === bill.id ? 'Printing…' : '🖨 Print Receipt'}
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      style={({ pressed }) => [styles.billPrintSystemBtn, pressed && pressedDim]}
                      android_ripple={ripple.onLight}
                      onPress={() => printBillSystem(bill)}
                      disabled={printingSystemId === bill.id}
                    >
                      <Text style={styles.billPrintSystemBtnText}>
                        {printingSystemId === bill.id ? 'Opening print dialog…' : '🖶 Print (WiFi / Any Printer)'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
  );

  const pickerModal = (
      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setPickerOpen(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Choose a day</Text>
            <FlatList
              data={availableDays}
              keyExtractor={(d) => dayKey(d.date)}
              style={styles.pickerList}
              ListEmptyComponent={<Text style={styles.pickerEmpty}>No bills saved yet.</Text>}
              renderItem={({ item }) => {
                const isSelected = dayKey(item.date) === dayKey(selectedDate);
                const isItemToday = dayKey(item.date) === dayKey(startOfDay(new Date()));
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.pickerRow,
                      isSelected && styles.pickerRowActive,
                      pressed && pressedDim,
                    ]}
                    android_ripple={ripple.onLight}
                    onPress={() => {
                      setSelectedDate(item.date);
                      setPickerOpen(false);
                    }}
                  >
                    <Text style={styles.pickerRowText}>
                      {isItemToday
                        ? 'Today'
                        : item.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                    <Text style={styles.pickerRowCount}>
                      {item.count} bill{item.count > 1 ? 's' : ''}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
  );

  if (isWeb) {
    return (
      <>
        <View style={styles.page}>
          <View style={styles.controlsPanel}>
            <ScrollView style={styles.controlsScroll} contentContainerStyle={styles.controlsScrollContent}>
              {controlsEl}
            </ScrollView>
          </View>
          <View style={styles.listPanel}>{billListEl}</View>
        </View>
        {pickerModal}
      </>
    );
  }

  return (
    <>
      <View style={styles.screen}>
        {controlsEl}
        {billListEl}
      </View>
      {pickerModal}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: spacing.listBottom,
  },
  // Web-only two-panel layout: date nav/summary/share/upload controls on
  // the left, the scrollable bill list on the right — mirrors the
  // two-panel pattern used on the Billing, Voice, and Payment screens.
  page: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.bg,
    padding: 12,
    gap: 12,
  },
  controlsPanel: {
    width: '38%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    ...raisedShadow,
  },
  controlsScroll: { flex: 1 },
  controlsScrollContent: { padding: 16 },
  listPanel: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    ...raisedShadow,
  },
  dateNavRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  dateNavBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...cardShadow,
  },
  dateNavBtnDisabled: { opacity: 0.35 },
  dateNavBtnText: { fontSize: 16, fontWeight: '700', color: colors.brand },
  dateLabelBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: 8,
    overflow: 'hidden',
    ...cardShadow,
  },
  dateLabelText: { fontSize: 16, fontWeight: '800', color: colors.text },
  dateLabelHint: { fontSize: 11, color: colors.textFaint, marginTop: 1 },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 16,
    maxHeight: '70%',
  },
  pickerTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 10, textAlign: 'center' },
  pickerList: { flexGrow: 0 },
  pickerEmpty: { textAlign: 'center', color: colors.textFaint, fontSize: 14, paddingVertical: 20 },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
  },
  pickerRowActive: { backgroundColor: colors.brandLight },
  pickerRowText: { fontSize: 15, fontWeight: '600', color: colors.text },
  pickerRowCount: { fontSize: 13, color: colors.textMuted },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingVertical: 16,
    ...cardShadow,
  },
  summaryStat: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  summaryValue: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  summaryLabel: { color: colors.brandLight, fontSize: 12, marginTop: 2, textAlign: 'center' },
  shareBtn: {
    backgroundColor: '#16a34a',
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    overflow: 'hidden',
    ...cardShadow,
  },
  shareBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  uploadBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    overflow: 'hidden',
    ...cardShadow,
  },
  uploadBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  uploadWarning: {
    color: '#b45309',
    backgroundColor: '#fef3c7',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    borderRadius: radius.sm,
    paddingVertical: 6,
    marginTop: 8,
  },
  list: { flex: 1, marginTop: 12 },
  listContent: { paddingBottom: spacing.listBottom },
  emptyBox: { alignItems: 'center', marginTop: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 8, opacity: 0.5 },
  empty: { textAlign: 'center', color: colors.textFaint, fontSize: 15 },
  billCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
    overflow: 'hidden',
    ...cardShadow,
  },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billTime: { fontSize: 15, fontWeight: '700', color: colors.text },
  billMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  billTotal: { fontSize: 17, fontWeight: '800', color: colors.brand },
  billDetail: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  billLine: { flexDirection: 'row', justifyContent: 'space-between' },
  billLineName: { fontSize: 13, color: colors.textMuted, flex: 1 },
  billLineAmount: { fontSize: 13, color: colors.text, fontWeight: '600' },
  billShareBtn: {
    backgroundColor: '#25D366',
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
    overflow: 'hidden',
  },
  billShareBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  billPrintBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 6,
    overflow: 'hidden',
  },
  billPrintBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  billPrintSystemBtn: {
    backgroundColor: colors.accentAmber,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 6,
    overflow: 'hidden',
  },
  billPrintSystemBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
});