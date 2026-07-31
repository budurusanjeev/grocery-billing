import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { iconFor } from '../lib/categories';
import { CUSTOMER_TYPES, loadItems, type Item } from '../lib/db';
import { searchItems } from '../lib/matcher';
import { cardShadow, colors, isWeb, pressedDim, radius, raisedShadow, ripple } from '../lib/theme';
import { confirmDialog, formatMoney, showMessage } from '../lib/ui';
import { useBill } from '../state/bill';

// This screen deliberately does NOT use <ScreenContainer> — that component
// centers everything in one narrow phone-width card, which is right for
// every other screen but wrong here: this needs two genuinely separate
// panels spanning the full width, not two columns squeezed inside one card.
export default function BillingScreen() {
  const router = useRouter();
  const { lines, customerType, setCustomerType, subtotal, discountRate, discount, total, addLine, updateQty, removeLine, clear } =
    useBill();
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadItems().then(setItems);
  }, []);

  const results = useMemo(() => searchItems(query, items), [query, items]);
  const categoryByItemId = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of items) map.set(it.id, it.category);
    return map;
  }, [items]);

  const onPay = () => {
    if (lines.length === 0) {
      showMessage('Empty bill', 'Add some items first.');
      return;
    }
    router.push('/pay');
  };

  const searchAndResults = (
    <>
      <TextInput
        style={styles.search}
        placeholder="Search item… (rice, pappu, sabbu)"
        placeholderTextColor={colors.textFaint}
        value={query}
        onChangeText={setQuery}
      />
      {results.length > 0 && (
        <View style={styles.results}>
          {results.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.resultRow, pressed && pressedDim]}
              android_ripple={ripple.onLight}
              onPress={() => {
                addLine(item);
                setQuery('');
              }}
            >
              <Text style={styles.resultIcon}>{iconFor(item.category)}</Text>
              <View style={styles.resultInfo}>
                <Text style={styles.resultName}>
                  {item.name_en}
                  {item.brand ? ` (${item.brand})` : ''}
                </Text>
                <Text style={styles.resultTe}>{item.name_te}</Text>
              </View>
              <Text style={styles.resultPrice}>
                {formatMoney(item.price)}/{item.unit}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );

  const customerTypeRow = (
    <View style={styles.customerTypeRow}>
      {CUSTOMER_TYPES.map((c) => (
        <Pressable
          key={c.key}
          style={({ pressed }) => [
            styles.customerChip,
            customerType === c.key && styles.customerChipActive,
            pressed && pressedDim,
          ]}
          android_ripple={ripple.onLight}
          onPress={() => setCustomerType(c.key)}
        >
          <Text style={[styles.customerChipText, customerType === c.key && styles.customerChipTextActive]}>
            {c.label}
            {c.discountPercent > 0 ? ` (${c.discountPercent}% off)` : ''}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const billListEl = (
    <FlatList
      style={styles.billList}
      contentContainerStyle={styles.listContent}
      data={lines}
      keyExtractor={(l) => l.itemId}
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>🧾</Text>
          <Text style={styles.empty}>
            Bill is empty.{'\n'}Search above, or use the buttons {isWeb ? 'on the right' : 'above'}.
          </Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={styles.billDivider} />}
      renderItem={({ item: l }) => (
        <View style={styles.billRow}>
          <Text style={styles.billIcon}>{iconFor(categoryByItemId.get(l.itemId) ?? '')}</Text>
          <View style={styles.billInfo}>
            <Text style={styles.billName} numberOfLines={1}>
              {l.name}
            </Text>
            <Text style={styles.billMeta}>
              {l.qty} {l.unit} × {formatMoney(l.price)}
            </Text>
          </View>
          <View style={styles.qtyGroup}>
            <Pressable
              style={({ pressed }) => [styles.qtyBtn, pressed && pressedDim]}
              android_ripple={ripple.onLight}
              onPress={() => updateQty(l.itemId, l.qty - 1)}
            >
              <Text style={styles.qtyBtnText}>−</Text>
            </Pressable>
            <Text style={styles.qtyValue}>{l.qty}</Text>
            <Pressable
              style={({ pressed }) => [styles.qtyBtn, pressed && pressedDim]}
              android_ripple={ripple.onLight}
              onPress={() => updateQty(l.itemId, l.qty + 1)}
            >
              <Text style={styles.qtyBtnText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.lineTotal}>{formatMoney(l.price * l.qty)}</Text>
          <Pressable
            style={({ pressed }) => [styles.removeBtn, pressed && pressedDim]}
            android_ripple={ripple.onLight}
            onPress={() => removeLine(l.itemId)}
          >
            <Text style={styles.remove}>✕</Text>
          </Pressable>
        </View>
      )}
    />
  );

  const navBtn = (
    key: string,
    icon: string,
    label: string,
    colorStyle: object,
    onPress: () => void,
    btnStyle: object,
  ) => (
    <Pressable
      key={key}
      style={({ pressed }) => [btnStyle, colorStyle, pressed && pressedDim]}
      android_ripple={ripple.onDark}
      onPress={onPress}
    >
      <Text style={styles.railIcon}>{icon}</Text>
      <Text style={styles.railText}>{label}</Text>
    </Pressable>
  );

  const onNewBill = () =>
    lines.length > 0 && confirmDialog('New bill', 'Clear the current bill?', clear);

  if (!isWeb) {
    // Mobile: buttons live in a row at the top (no Pay — Pay sits with
    // Total at the bottom, since that's the action taken right when
    // checking out, not a navigation button).
    return (
      <View style={styles.mobileScreen}>
        <View style={styles.topBtnRow}>
          {navBtn('voice', '🎤', 'Voice', styles.voice, () => router.push('/voice'), styles.topBtn)}
          {navBtn('scan', '📷', 'Scan', styles.scan, () => router.push('/scan'), styles.topBtn)}
          {navBtn('catalog', '🏷', 'Prices', styles.catalog, () => router.push('/catalog'), styles.topBtn)}
          {navBtn('history', '📊', 'Today', styles.history, () => router.push('/history'), styles.topBtn)}
          {navBtn('newBill', '🗑', 'New', styles.newBill, onNewBill, styles.topBtn)}
        </View>

        <View style={styles.mobilePanel}>
          {searchAndResults}
          {billListEl}
        </View>

        {customerTypeRow}

        <View style={styles.totalPayRow}>
          <View style={styles.totalBarMobile}>
            <View>
              <Text style={styles.totalLabel}>Total</Text>
              {discount > 0 && (
                <Text style={styles.discountHint}>
                  {formatMoney(subtotal)} − {discountRate}% = −{formatMoney(discount)}
                </Text>
              )}
            </View>
            <Text style={styles.totalValue}>{formatMoney(total)}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.payBtnMobile, pressed && pressedDim]}
            android_ripple={ripple.onDark}
            onPress={onPay}
          >
            <Text style={styles.railIcon}>💳</Text>
            <Text style={styles.railText}>Pay</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.itemsPanel}>
        {searchAndResults}
        {billListEl}
        {customerTypeRow}

        <View style={styles.totalBar}>
          <View>
            <Text style={styles.totalLabel}>Total</Text>
            {discount > 0 && (
              <Text style={styles.discountHint}>
                {formatMoney(subtotal)} − {discountRate}% = −{formatMoney(discount)}
              </Text>
            )}
          </View>
          <Text style={styles.totalValue}>{formatMoney(total)}</Text>
        </View>
      </View>

      <View style={styles.buttonsPanel}>
        {navBtn('voice', '🎤', 'Voice', styles.voice, () => router.push('/voice'), styles.railBtn)}
        {navBtn('scan', '📷', 'Scan', styles.scan, () => router.push('/scan'), styles.railBtn)}
        {navBtn('catalog', '🏷', 'Prices', styles.catalog, () => router.push('/catalog'), styles.railBtn)}
        {navBtn('history', '📊', 'Today', styles.history, () => router.push('/history'), styles.railBtn)}
        {navBtn('newBill', '🗑', 'New', styles.newBill, onNewBill, styles.railBtn)}
        {navBtn('pay', '💳', 'Pay', styles.pay, onPay, styles.railBtn)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.bg,
    padding: 12,
    gap: 12,
  },
  // Two genuinely separate panels — each its own card with its own
  // background/shadow/rounded corners — not two columns inside one shared
  // container. Widths are explicit percentages of the full page, which
  // itself is NOT centered/width-capped (unlike every other screen's
  // <ScreenContainer>), so this uses the whole browser width on web.
  itemsPanel: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    ...raisedShadow,
  },
  // Fixed max width, NOT a percentage — on a wide monitor, 30% of the full
  // page is still 400-500px, which is what stretched the buttons huge.
  buttonsPanel: {
    width: '30%',
    maxWidth: 150,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 10,
    gap: 8,
    ...raisedShadow,
  },
  railBtn: {
    // Fixed height, not flex:1 — flex:1 made each button stretch to fill
    // the panel's full height (nearly the whole screen), which combined
    // with the width made them look like giant stretched rectangles.
    height: 68,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    overflow: 'hidden',
    ...cardShadow,
  },
  railIcon: { fontSize: 18 },
  railText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  // Mobile-only layout: a horizontal row of nav buttons at the top, one
  // full-width panel below for search+list, and Total+Pay combined into a
  // single bottom row (Pay sits next to Total, not in the top nav row,
  // since it's the checkout action rather than a screen-navigation button).
  mobileScreen: { flex: 1, backgroundColor: colors.bg, padding: 12 },
  topBtnRow: { flexDirection: 'row', gap: 6 },
  topBtn: {
    flex: 1,
    height: 60,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    overflow: 'hidden',
    ...cardShadow,
  },
  mobilePanel: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    marginTop: 10,
    ...raisedShadow,
  },
  totalPayRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  totalBarMobile: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...cardShadow,
  },
  payBtnMobile: {
    flex: 1,
    backgroundColor: '#16a34a',
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    overflow: 'hidden',
    ...cardShadow,
  },
  voice: { backgroundColor: colors.accentPurple },
  scan: { backgroundColor: colors.accentBlue },
  catalog: { backgroundColor: colors.accentAmber },
  newBill: { backgroundColor: '#64748b' },
  history: { backgroundColor: '#0d9488' },
  pay: { backgroundColor: '#16a34a' },
  search: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  results: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    marginTop: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  resultIcon: { fontSize: 30 },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 15, fontWeight: '600', color: colors.text },
  resultTe: { fontSize: 13, color: colors.textMuted },
  resultPrice: { fontSize: 14, fontWeight: '700', color: colors.brand },
  billList: { flex: 1, marginTop: 8 },
  listContent: { paddingBottom: 8 },
  emptyBox: { alignItems: 'center', marginTop: 36 },
  emptyIcon: { fontSize: 40, marginBottom: 8, opacity: 0.5 },
  empty: { textAlign: 'center', color: colors.textFaint, fontSize: 15, lineHeight: 24 },
  // A clean divider-separated list (like a receipt) instead of stacked
  // shadowed cards — on the wide 70% panel, individual full-width cards
  // with flex-pushed content just left a big dead gap between the name and
  // the controls. Capping billInfo's width and grouping the qty stepper
  // into its own pill keeps the row content close together instead of
  // stretched corner-to-corner.
  billDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 2 },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 10,
  },
  billIcon: { fontSize: 24, width: 30, textAlign: 'center' },
  billInfo: { flex: 1, maxWidth: 260 },
  billName: { fontSize: 15, fontWeight: '600', color: colors.text },
  billMeta: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  qtyGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 3,
    gap: 2,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qtyBtnText: { fontSize: 16, fontWeight: '700', color: colors.text },
  qtyValue: { fontSize: 14, fontWeight: '700', color: colors.text, minWidth: 26, textAlign: 'center' },
  lineTotal: { fontSize: 15, fontWeight: '700', color: colors.brand, minWidth: 70, textAlign: 'right' },
  removeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  remove: { color: colors.accentRed, fontSize: 16 },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 8,
  },
  totalLabel: { color: colors.brandLight, fontSize: 16, fontWeight: '600' },
  totalValue: { color: '#ffffff', fontSize: 26, fontWeight: '800' },
  discountHint: { color: colors.brandLight, fontSize: 11, marginTop: 2 },
  customerTypeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  customerChip: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    overflow: 'hidden',
  },
  customerChipActive: { backgroundColor: colors.brandLight, borderColor: colors.brand },
  customerChipText: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted },
  customerChipTextActive: { color: colors.brandDark },
});