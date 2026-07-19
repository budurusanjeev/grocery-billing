import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { loadItems, saveBill, type Item } from '../lib/db';
import { searchItems } from '../lib/matcher';
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
    <View style={styles.screen}>
      <TextInput
        style={styles.search}
        placeholder="Search item… (rice, pappu, sabbu)"
        placeholderTextColor="#94a3b8"
        value={query}
        onChangeText={setQuery}
      />
      {results.length > 0 && (
        <View style={styles.results}>
          {results.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.resultRow}
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
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        style={styles.billList}
        data={lines}
        keyExtractor={(l) => l.itemId}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Bill is empty.{'\n'}Search above, or use Voice / Scan below.
          </Text>
        }
        renderItem={({ item: l }) => (
          <View style={styles.billRow}>
            <View style={styles.billInfo}>
              <Text style={styles.billName}>{l.name}</Text>
              <Text style={styles.billMeta}>
                {l.qty} {l.unit} × {formatMoney(l.price)}
              </Text>
            </View>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(l.itemId, l.qty - 1)}>
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(l.itemId, l.qty + 1)}>
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
            <Text style={styles.lineTotal}>{formatMoney(l.price * l.qty)}</Text>
            <TouchableOpacity onPress={() => removeLine(l.itemId)}>
              <Text style={styles.remove}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <View style={styles.totalBar}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatMoney(total)}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.action, styles.voice]} onPress={() => router.push('/voice')}>
          <Text style={styles.actionText}>🎤 Voice</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.action, styles.scan]} onPress={() => router.push('/scan')}>
          <Text style={styles.actionText}>📷 Scan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.action, styles.catalog]} onPress={() => router.push('/catalog')}>
          <Text style={styles.actionText}>🏷 Prices</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.action, styles.newBill]}
          onPress={() =>
            lines.length > 0 && confirmDialog('New bill', 'Clear the current bill?', clear)
          }
        >
          <Text style={styles.actionText}>🗑 New Bill</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.action, styles.save]} onPress={onSaveBill}>
          <Text style={styles.actionText}>💾 Save Bill</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc', padding: 12 },
  search: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  results: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    marginTop: 4,
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
  resultName: { fontSize: 15, fontWeight: '600', color: '#0f172a', flexShrink: 1 },
  resultTe: { fontSize: 13, color: '#64748b', flex: 1 },
  resultPrice: { fontSize: 14, fontWeight: '700', color: '#166534' },
  billList: { flex: 1, marginTop: 10 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 15, lineHeight: 24 },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    gap: 8,
  },
  billInfo: { flex: 1 },
  billName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  billMeta: { fontSize: 13, color: '#64748b' },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  lineTotal: { fontSize: 15, fontWeight: '700', color: '#166534', minWidth: 60, textAlign: 'right' },
  remove: { color: '#dc2626', fontSize: 16, paddingHorizontal: 6 },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#166534',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 6,
  },
  totalLabel: { color: '#bbf7d0', fontSize: 16, fontWeight: '600' },
  totalValue: { color: '#ffffff', fontSize: 24, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  action: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  voice: { backgroundColor: '#7c3aed' },
  scan: { backgroundColor: '#0ea5e9' },
  catalog: { backgroundColor: '#f59e0b' },
  newBill: { backgroundColor: '#64748b' },
  save: { backgroundColor: '#16a34a' },
  actionText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
