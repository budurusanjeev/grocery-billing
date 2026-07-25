import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { addItem, loadItems, updateItem, type Item, type Unit } from '../lib/db';
import { cardShadow, colors, pressedDim, radius, ripple, spacing } from '../lib/theme';
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameTe, setEditNameTe] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editUnit, setEditUnit] = useState<Unit>('kg');

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

  const startEdit = (item: Item) => {
    setEditingId(item.id);
    setEditName(item.name_en);
    setEditNameTe(item.name_te);
    setEditPrice(String(item.price));
    setEditUnit(item.unit);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (item: Item) => {
    const price = parseFloat(editPrice);
    if (!editName.trim() || isNaN(price) || price < 0) {
      showMessage('Missing details', 'Enter at least an item name and a valid price.');
      return;
    }
    const next = await updateItem({
      ...item,
      name_en: editName.trim(),
      name_te: editNameTe.trim(),
      unit: editUnit,
      price,
    });
    setItems(next);
    setEditingId(null);
  };

  return (
    <ScreenContainer>
      <View style={styles.screen}>
        <TextInput
          style={styles.search}
          placeholder="Search catalog…"
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
        />

        <Pressable
          style={({ pressed }) => [styles.addToggle, pressed && pressedDim]}
          android_ripple={ripple.onLight}
          onPress={() => setShowAdd((s) => !s)}
        >
          <Text style={styles.addToggleText}>{showAdd ? '− Cancel' : '+ Add New Item'}</Text>
        </Pressable>

        {showAdd && (
          <View style={styles.addForm}>
            <TextInput
              style={styles.input}
              placeholder="Item name (English)"
              placeholderTextColor={colors.textFaint}
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={styles.input}
              placeholder="Item name (Telugu, optional)"
              placeholderTextColor={colors.textFaint}
              value={newNameTe}
              onChangeText={setNewNameTe}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.priceInput]}
                placeholder="Price ₹"
                placeholderTextColor={colors.textFaint}
                keyboardType="numeric"
                value={newPrice}
                onChangeText={setNewPrice}
              />
              {UNITS.map((u) => (
                <Pressable
                  key={u}
                  style={({ pressed }) => [
                    styles.unitChip,
                    newUnit === u && styles.unitChipActive,
                    pressed && pressedDim,
                  ]}
                  android_ripple={ripple.onLight}
                  onPress={() => setNewUnit(u)}
                >
                  <Text style={[styles.unitChipText, newUnit === u && styles.unitChipTextActive]}>
                    {u}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && pressedDim]}
              android_ripple={ripple.onDark}
              onPress={onAddItem}
            >
              <Text style={styles.saveBtnText}>Save Item</Text>
            </Pressable>
          </View>
        )}

        <FlatList
          data={filtered}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) =>
            editingId === item.id ? (
              <View style={styles.editForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Item name (English)"
                  placeholderTextColor={colors.textFaint}
                  value={editName}
                  onChangeText={setEditName}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Item name (Telugu, optional)"
                  placeholderTextColor={colors.textFaint}
                  value={editNameTe}
                  onChangeText={setEditNameTe}
                />
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.priceInput]}
                    placeholder="Price ₹"
                    placeholderTextColor={colors.textFaint}
                    keyboardType="numeric"
                    value={editPrice}
                    onChangeText={setEditPrice}
                  />
                  {UNITS.map((u) => (
                    <Pressable
                      key={u}
                      style={({ pressed }) => [
                        styles.unitChip,
                        editUnit === u && styles.unitChipActive,
                        pressed && pressedDim,
                      ]}
                      android_ripple={ripple.onLight}
                      onPress={() => setEditUnit(u)}
                    >
                      <Text style={[styles.unitChipText, editUnit === u && styles.unitChipTextActive]}>
                        {u}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.row}>
                  <Pressable
                    style={({ pressed }) => [styles.saveBtn, styles.editBtnHalf, pressed && pressedDim]}
                    android_ripple={ripple.onDark}
                    onPress={() => saveEdit(item)}
                  >
                    <Text style={styles.saveBtnText}>Save</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.cancelBtn, styles.editBtnHalf, pressed && pressedDim]}
                    android_ripple={ripple.onLight}
                    onPress={cancelEdit}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
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
                <Pressable
                  style={({ pressed }) => [styles.editIconBtn, pressed && pressedDim]}
                  android_ripple={ripple.onLight}
                  onPress={() => startEdit(item)}
                >
                  <Text style={styles.editIcon}>✎</Text>
                </Pressable>
              </View>
            )
          }
        />
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
  listContent: { paddingBottom: spacing.listBottom },
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
  addToggle: { paddingVertical: 10, borderRadius: radius.sm, overflow: 'hidden' },
  addToggleText: { color: colors.brand, fontWeight: '700', fontSize: 15 },
  addForm: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
    gap: 8,
    ...cardShadow,
  },
  editForm: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 7,
    gap: 8,
    borderWidth: 2,
    borderColor: colors.accentBlue,
  },
  editBtnHalf: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  priceInput: { width: 90 },
  unitChip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  unitChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  unitChipText: { fontSize: 13, color: '#334155' },
  unitChipTextActive: { color: '#ffffff', fontWeight: '700' },
  saveBtn: {
    backgroundColor: '#16a34a',
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
  saveBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  cancelBtn: {
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
  cancelBtnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 7,
    gap: 6,
    ...cardShadow,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.text },
  itemMeta: { fontSize: 13, color: colors.textMuted },
  rupee: { fontSize: 16, color: colors.brand, fontWeight: '700' },
  priceEdit: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    minWidth: 70,
    textAlign: 'right',
    backgroundColor: colors.bg,
  },
  editIconBtn: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: radius.sm, overflow: 'hidden' },
  editIcon: { fontSize: 17, color: colors.accentBlue },
});
