import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { getBills, type Bill } from '../lib/db';
import { uploadBills } from '../lib/sync';
import { cardShadow, colors, pressedDim, radius, ripple, spacing } from '../lib/theme';
import { formatMoney, showMessage } from '../lib/ui';

const PAYMENT_ICON: Record<string, string> = { cash: '💵', upi: '📱', card: '💳' };
const CUSTOMER_LABEL: Record<string, string> = { regular: 'Regular', retailer: 'Retailer', wholesaler: 'Wholesaler' };

function isToday(isoDate: string): boolean {
  const d = new Date(isoDate);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function HistoryScreen() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getBills().then(setBills);
  }, []);

  const todaysBills = useMemo(() => bills.filter((b) => isToday(b.created_at)), [bills]);
  const totalRevenue = useMemo(() => todaysBills.reduce((sum, b) => sum + b.total, 0), [todaysBills]);
  const totalItems = useMemo(
    () => todaysBills.reduce((sum, b) => sum + b.lines.reduce((n, l) => n + l.qty, 0), 0),
    [todaysBills],
  );

  const shareDaySummary = () => {
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const text = [
      `Kirana Bill — Day Summary (${today})`,
      `Bills: ${todaysBills.length}`,
      `Total sales: ${formatMoney(totalRevenue)}`,
    ].join('\n');
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  const onUploadAll = async () => {
    setUploading(true);
    try {
      const { uploaded } = await uploadBills();
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
      `Kirana Bill — ${time}`,
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

  return (
      <View style={styles.screen}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{todaysBills.length}</Text>
            <Text style={styles.summaryLabel}>Bills today</Text>
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

        {todaysBills.length > 0 && (
          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && pressedDim]}
            android_ripple={ripple.onDark}
            onPress={shareDaySummary}
          >
            <Text style={styles.shareBtnText}>📤 Share Day Summary on WhatsApp</Text>
          </Pressable>
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

        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={todaysBills}
          keyExtractor={(b) => b.id}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🧾</Text>
              <Text style={styles.empty}>No bills saved yet today.</Text>
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
                    <Text style={styles.billTime}>{time}</Text>
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
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      </View>
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
});