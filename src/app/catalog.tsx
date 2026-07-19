import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { addItem, loadItems, updateItem, type Item, type Unit } from '../lib/db';
import { showMessage } from '../lib/ui';

const UNITS: Unit[] = ['kg', 'packet', 'piece', 'litre', 'dozen'];

export default function CatalogScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNameTe, setNewNameTe] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newUnit, setNewUnit] = useState<Unit>('kg');

  useEffect(() => {
    loadItems().then(setItems);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.name_en.toLowerCase().includes(q) ||
        it.name_te.includes(query.trim()) ||
        (it.brand ?? '').toLowerCase().includes(q) ||
        it.aliases.some((a) => a.toLowerCase().includes(q)),
    );
  }, [query, items]);

  const onPriceChange = async (item: Item, text: string) => {
    const price = parseFloat(text);
    if (isNaN(price) || price < 0) return;
    const next = await updateItem({ ...item, price });
    setItems(next);
  };

  const onAddItem = async () => {
    const price = parseFloat(newPrice);
    if (!newName.trim() || isNaN(price) || price <= 0) {
      showMessage('Missing details', 'Enter at least an item name and a valid price.');
      return;
    }
    const id = `custom-${Date.now()}`;
    const next = await addItem({
      id,
      name_en: newName.trim(),
      name_te: newNameTe.trim(),
      aliases: [newName.trim().toLowerCase()],
      category: 'Custom',
      brand: null,
      unit: newUnit,
      price,
    });
    setItems(next);
    setShowAdd(false);
    setNewName('');
    setNewNameTe('');
    setNewPrice('');
  };

  return (
    <View style={styles.screen}>
      <TextInput
        style={styles.search}
        placeholder="Search catalog…"
        placeholderTextColor="#94a3b8"
        value={query}
        onChangeText={setQuery}
      />

      <TouchableOpacity style={styles.addToggle} onPress={() => setShowAdd((s) => !s)}>
        <Text style={styles.addToggleText}>{showAdd ? '− Cancel' : '+ Add New Item'}</Text>
      </TouchableOpacity>

      {showAdd && (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            placeholder="Item name (English)"
            placeholderTextColor="#94a3b8"
            value={newName}
            onChangeText={setNewName}
          />
          <TextInput
            style={styles.input}
            placeholder="Item name (Telugu, optional)"
            placeholderTextColor="#94a3b8"
            value={newNameTe}
            onChangeText={setNewNameTe}
          />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.priceInput]}
              placeholder="Price ₹"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={newPrice}
              onChangeText={setNewPrice}
            />
            {UNITS.map((u) => (
              <TouchableOpacity
                key={u}
                style={[styles.unitChip, newUnit === u && styles.unitChipActive]}
                onPress={() => setNewUnit(u)}
              >
                <Text style={[styles.unitChipText, newUnit === u && styles.unitChipTextActive]}>
                  {u}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={onAddItem}>
            <Text style={styles.saveBtnText}>Save Item</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>
                {item.name_en}
                {item.brand ? ` (${item.brand})` : ''}
              </Text>
              <Text style={styles.itemMeta}>
                {item.name_te} · per {item.unit}
              </Text>
            </View>
            <Text style={styles.rupee}>₹</Text>
            <TextInput
              style={styles.priceEdit}
              defaultValue={String(item.price)}
              keyboardType="numeric"
              onEndEditing={(e) => onPriceChange(item, e.nativeEvent.text)}
              onBlur={() => {}}
            />
          </View>
        )}
      />
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
  addToggle: { paddingVertical: 10 },
  addToggleText: { color: '#166534', fontWeight: '700', fontSize: 15 },
  addForm: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  priceInput: { width: 90 },
  unitChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  unitChipActive: { backgroundColor: '#166534', borderColor: '#166534' },
  unitChipText: { fontSize: 13, color: '#334155' },
  unitChipTextActive: { color: '#ffffff', fontWeight: '700' },
  saveBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    gap: 6,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  itemMeta: { fontSize: 13, color: '#64748b' },
  rupee: { fontSize: 16, color: '#166534', fontWeight: '700' },
  priceEdit: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    minWidth: 70,
    textAlign: 'right',
    backgroundColor: '#f8fafc',
  },
});
