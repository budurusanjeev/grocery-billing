import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { loadItems, saveBill, type Item } from '../lib/db';
import { searchItems } from '../lib/matcher';
import { cardShadow, colors, pressedDim, radius, ripple, spacing } from '../lib/theme';
import { confirmDialog, formatMoney, showMessage } from '../lib/ui';
import { useBill } from '../state/bill';

export default function BillingScreen() {
  const router = useRouter();
  const { lines, total, addLine, updateQty, removeLine, clear } = useBill();
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadItems().then(setItems);
  }, []);

  const results = useMemo(() => searchItems(query, items), [query, items]);

  const onSaveBill = async () => {
    if (lines.length === 0) {
      showMessage('Empty bill', 'Add some items first.');
      return;
    }
    await saveBill(lines, total);
    const text = [
      'Kirana Bill',
      ...lines.map((l) => `${l.name} — ${l.qty} ${l.unit} × ${formatMoney(l.price)} = ${formatMoney(l.price * l.qty)}`),
      `Total: ${formatMoney(total)}`,
    ].join('\n');
    confirmDialog('Bill saved', 'Share this bill on WhatsApp?', () => {
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
    });
    clear();
  };

  return (
    <ScreenContainer>
      <View style={styles.screen}>
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
                <Text style={styles.resultName}>
                  {item.name_en}
                  {item.brand ? ` (${item.brand})` : ''}
                </Text>
                <Text style={styles.resultTe}>{item.name_te}</Text>
                <Text style={styles.resultPrice}>
                  {formatMoney(item.price)}/{item.unit}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <FlatList
          style={styles.billList}
          contentContainerStyle={styles.listContent}
          data={lines}
          keyExtractor={(l) => l.itemId}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🧾</Text>
              <Text style={styles.empty}>
                Bill is empty.{'\n'}Search above, or use Voice / Scan below.
              </Text>
            </View>
          }
          renderItem={({ item: l }) => (
            <View style={styles.billRow}>
              <View style={styles.billInfo}>
                <Text style={styles.billName}>{l.name}</Text>
                <Text style={styles.billMeta}>
                  {l.qty} {l.unit} × {formatMoney(l.price)}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.qtyBtn, pressed && pressedDim]}
                android_ripple={ripple.onLight}
                onPress={() => updateQty(l.itemId, l.qty - 1)}
              >
                <Text style={styles.qtyBtnText}>−</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.qtyBtn, pressed && pressedDim]}
                android_ripple={ripple.onLight}
                onPress={() => updateQty(l.itemId, l.qty + 1)}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </Pressable>
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

        <View style={styles.totalBar}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatMoney(total)}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.action, styles.voice, pressed && pressedDim]}
            android_ripple={ripple.onDark}
            onPress={() => router.push('/voice')}
          >
            <Text style={styles.actionIcon}>🎤</Text>
            <Text style={styles.actionText}>Voice</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.action, styles.scan, pressed && pressedDim]}
            android_ripple={ripple.onDark}
            onPress={() => router.push('/scan')}
          >
            <Text style={styles.actionIcon}>📷</Text>
            <Text style={styles.actionText}>Scan</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.action, styles.catalog, pressed && pressedDim]}
            android_ripple={ripple.onDark}
            onPress={() => router.push('/catalog')}
          >
            <Text style={styles.actionIcon}>🏷</Text>
            <Text style={styles.actionText}>Prices</Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.action, styles.newBill, pressed && pressedDim]}
            android_ripple={ripple.onDark}
            onPress={() =>
              lines.length > 0 && confirmDialog('New bill', 'Clear the current bill?', clear)
            }
          >
            <Text style={styles.actionIcon}>🗑</Text>
            <Text style={styles.actionText}>New Bill</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.action, styles.save, pressed && pressedDim]}
            android_ripple={ripple.onDark}
            onPress={onSaveBill}
          >
            <Text style={styles.actionIcon}>💾</Text>
            <Text style={styles.actionText}>Save Bill</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
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
  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    ...cardShadow,
  },
  results: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginTop: 6,
    overflow: 'hidden',
    ...cardShadow,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  resultName: { fontSize: 15, fontWeight: '600', color: colors.text, flexShrink: 1 },
  resultTe: { fontSize: 13, color: colors.textMuted, flex: 1 },
  resultPrice: { fontSize: 14, fontWeight: '700', color: colors.brand },
  billList: { flex: 1, marginTop: 10 },
  listContent: { paddingBottom: spacing.listBottom },
  emptyBox: { alignItems: 'center', marginTop: 36 },
  emptyIcon: { fontSize: 40, marginBottom: 8, opacity: 0.5 },
  empty: { textAlign: 'center', color: colors.textFaint, fontSize: 15, lineHeight: 24 },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 7,
    gap: 8,
    ...cardShadow,
  },
  billInfo: { flex: 1 },
  billName: { fontSize: 15, fontWeight: '600', color: colors.text },
  billMeta: { fontSize: 13, color: colors.textMuted },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qtyBtnText: { fontSize: 18, fontWeight: '700', color: colors.text },
  lineTotal: { fontSize: 15, fontWeight: '700', color: colors.brand, minWidth: 60, textAlign: 'right' },
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
    marginTop: 6,
    ...cardShadow,
  },
  totalLabel: { color: colors.brandLight, fontSize: 16, fontWeight: '600' },
  totalValue: { color: '#ffffff', fontSize: 26, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  action: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 3,
    overflow: 'hidden',
    ...cardShadow,
  },
  voice: { backgroundColor: colors.accentPurple },
  scan: { backgroundColor: colors.accentBlue },
  catalog: { backgroundColor: colors.accentAmber },
  newBill: { backgroundColor: '#64748b' },
  save: { backgroundColor: '#16a34a' },
  actionIcon: { fontSize: 18 },
  actionText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
});
