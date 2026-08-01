import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ALL_CATEGORIES, CATEGORY_ORDER, iconFor } from '../lib/categories';
import { addItem, loadItems, updateItem, type Item, type Unit } from '../lib/db';
import { requireInternet } from '../lib/network';
import { fetchAndMergeNewItems } from '../lib/sync';
import { cardShadow, colors, pressedDim, radius, ripple, spacing } from '../lib/theme';
import { confirmDialog, showMessage } from '../lib/ui';
import { useAuth } from '../state/auth';

const UNITS: Unit[] = ['kg', 'packet', 'piece', 'litre', 'dozen'];

export default function CatalogScreen() {
  const { signOut } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNameTe, setNewNameTe] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newCategory, setNewCategory] = useState('Custom');
  const [newPrice, setNewPrice] = useState('');
  const [newUnit, setNewUnit] = useState<Unit>('kg');
  const [newNoDiscount, setNewNoDiscount] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameTe, setEditNameTe] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editCategory, setEditCategory] = useState('Custom');
  const [editPrice, setEditPrice] = useState('');
  const [editUnit, setEditUnit] = useState<Unit>('kg');
  const [editNoDiscount, setEditNoDiscount] = useState(false);

  useEffect(() => {
    loadItems().then(setItems);
  }, []);

  // Which categories are toggled open — tap a header to expand/collapse it.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Expanding a category (especially near the bottom of ~100 items) reveals
  // rows below the fold with nothing to hint they appeared — scroll the
  // newly opened section into view once its items exist in `sections`.
  const [pendingScrollTo, setPendingScrollTo] = useState<string | null>(null);
  const listRef = useRef<SectionList<Item>>(null);

  const toggleCategory = (title: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
        setPendingScrollTo(title);
      }
      return next;
    });
  };

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

  // While actively searching, collapsed categories are ignored so matches
  // are never hidden — collapsing is purely a browsing convenience.
  const searching = query.trim().length > 0;

  const sections = useMemo(() => {
    const byCategory = new Map<string, Item[]>();
    for (const it of filtered) {
      const list = byCategory.get(it.category) ?? [];
      list.push(it);
      byCategory.set(it.category, list);
    }
    const orderedCategories = [
      ...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
      ...[...byCategory.keys()].filter((c) => !CATEGORY_ORDER.includes(c)),
    ];

    const result: {
      title: string;
      data: Item[];
      kind: 'category' | 'brand';
      count: number;
      isOpen?: boolean;
    }[] = [];
    for (const category of orderedCategories) {
      const catItems = byCategory.get(category)!;
      const isOpen = searching || expanded.has(category);

      if (!isOpen) {
        result.push({ title: category, data: [], kind: 'category', count: catItems.length, isOpen: false });
        continue;
      }

      const byBrand = new Map<string, Item[]>();
      for (const it of catItems) {
        const key = it.brand ?? '';
        const list = byBrand.get(key) ?? [];
        list.push(it);
        byBrand.set(key, list);
      }
      const distinctBrands = [...byBrand.keys()].filter((b) => b !== '').length;

      if (distinctBrands < 2) {
        // Not worth a brand breakdown for a single (or no) brand — keep it flat.
        result.push({ title: category, data: catItems, kind: 'category', count: catItems.length });
        continue;
      }
      // Multiple brands in this category — a header-only "super" row for the
      // category, then one lighter sub-header per brand (unbranded last).
      result.push({ title: category, data: [], kind: 'category', count: catItems.length });
      for (const [brand, brandItems] of byBrand) {
        if (brand === '') continue;
        result.push({ title: brand, data: brandItems, kind: 'brand', count: brandItems.length });
      }
      const unbranded = byBrand.get('');
      if (unbranded) {
        result.push({ title: 'Other', data: unbranded, kind: 'brand', count: unbranded.length });
      }
    }
    return result;
  }, [filtered, expanded, searching]);

  // A multi-brand category's own header section has no items of its own
  // (data: []) — its rows live in the brand sub-sections right after it,
  // so the scroll target is the first section with actual data, not
  // necessarily the header's own (possibly empty) section.
  const findScrollTarget = (fromIndex: number) => {
    for (let i = fromIndex; i < sections.length; i++) {
      if (i > fromIndex && sections[i].kind === 'category') break;
      if (sections[i].data.length > 0) return i;
    }
    return fromIndex;
  };

  // onScrollToIndexFailed's `info.index` is a flattened internal index into
  // VirtualizedList's own bookkeeping, NOT our `sections` sectionIndex — using
  // it directly for a retry scrolls to a bogus target (this is what caused
  // the jump-to-top bug). Remember our own resolved index instead and retry
  // with that.
  const lastScrollTargetRef = useRef<number | null>(null);

  const scrollToCategory = (headerIndex: number) => {
    const sectionIndex = findScrollTarget(headerIndex);
    lastScrollTargetRef.current = sectionIndex;
    listRef.current?.scrollToLocation({
      sectionIndex,
      itemIndex: 0,
      animated: true,
      viewPosition: 0,
    });
  };

  useEffect(() => {
    if (!pendingScrollTo) return;
    const headerIndex = sections.findIndex((s) => s.kind === 'category' && s.title === pendingScrollTo);
    if (headerIndex !== -1) scrollToCategory(headerIndex);
    setPendingScrollTo(null);
  }, [sections, pendingScrollTo]);

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
      category: newCategory,
      brand: newBrand.trim() || null,
      unit: newUnit,
      price,
      noDiscount: newNoDiscount,
    });
    setItems(next);
    setShowAdd(false);
    setNewName('');
    setNewNameTe('');
    setNewBrand('');
    setNewCategory('Custom');
    setNewPrice('');
    setNewNoDiscount(false);
  };

  const onFetchNewItems = async () => {
    if (!(await requireInternet())) return;
    setSyncing(true);
    try {
      const { added, items: merged } = await fetchAndMergeNewItems();
      setItems(merged);
      showMessage('Sync complete', added > 0 ? `Added ${added} new item(s).` : 'No new items.');
    } catch (e: any) {
      showMessage('Sync failed', e?.message ?? 'Could not reach the server.');
    } finally {
      setSyncing(false);
    }
  };

  const startEdit = (item: Item) => {
    setEditingId(item.id);
    setEditName(item.name_en);
    setEditNameTe(item.name_te);
    setEditBrand(item.brand ?? '');
    setEditCategory(item.category);
    setEditPrice(String(item.price));
    setEditUnit(item.unit);
    setEditNoDiscount(!!item.noDiscount);
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
      brand: editBrand.trim() || null,
      category: editCategory,
      unit: editUnit,
      price,
      noDiscount: editNoDiscount,
    });
    setItems(next);
    setEditingId(null);
  };

  return (
      <View style={styles.screen}>
        <TextInput
          style={styles.search}
          placeholder="Search catalog…"
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
        />

        <View style={styles.topActionsRow}>
          <Pressable
            style={({ pressed }) => [styles.addToggle, pressed && pressedDim]}
            android_ripple={ripple.onLight}
            onPress={() => setShowAdd((s) => !s)}
          >
            <Text style={styles.addToggleText}>{showAdd ? '− Cancel' : '+ Add New Item'}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.syncBtn, pressed && pressedDim]}
            android_ripple={ripple.onLight}
            onPress={onFetchNewItems}
            disabled={syncing}
          >
            <Text style={styles.syncBtnText}>{syncing ? 'Fetching…' : '⬇ Fetch New Items'}</Text>
          </Pressable>
        </View>

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
            <TextInput
              style={styles.input}
              placeholder="Company (optional, e.g. Parle, Britannia)"
              placeholderTextColor={colors.textFaint}
              value={newBrand}
              onChangeText={setNewBrand}
            />
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.row}>
              {ALL_CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  style={({ pressed }) => [
                    styles.catChip,
                    newCategory === c && styles.unitChipActive,
                    pressed && pressedDim,
                  ]}
                  android_ripple={ripple.onLight}
                  onPress={() => setNewCategory(c)}
                >
                  <Text style={[styles.unitChipText, newCategory === c && styles.unitChipTextActive]}>
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>
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
              style={({ pressed }) => [
                styles.noDiscountToggle,
                newNoDiscount && styles.noDiscountToggleActive,
                pressed && pressedDim,
              ]}
              android_ripple={ripple.onLight}
              onPress={() => setNewNoDiscount((v) => !v)}
            >
              <Text style={styles.noDiscountToggleText}>
                {newNoDiscount ? '☑' : '☐'} No customer discount on this item
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && pressedDim]}
              android_ripple={ripple.onDark}
              onPress={onAddItem}
            >
              <Text style={styles.saveBtnText}>Save Item</Text>
            </Pressable>
          </View>
        )}

        <SectionList
          ref={listRef}
          style={styles.list}
          sections={sections}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled
          // The whole catalog is only ~100 rows — render it all up front so
          // scrollToLocation always has a measured target and never needs
          // the onScrollToIndexFailed fallback in the first place.
          initialNumToRender={200}
          onScrollToIndexFailed={() => {
            // Target row hasn't been measured yet (common when it's beyond
            // the initially rendered window) — retry with our own resolved
            // index once layout settles (see lastScrollTargetRef above).
            const target = lastScrollTargetRef.current;
            if (target === null) return;
            setTimeout(() => {
              listRef.current?.scrollToLocation({
                sectionIndex: target,
                itemIndex: 0,
                animated: true,
                viewPosition: 0,
              });
            }, 100);
          }}
          renderSectionHeader={({ section }) =>
            section.kind === 'brand' ? (
              <View style={styles.brandHeader}>
                <Text style={styles.brandHeaderText}>{section.title}</Text>
                <Text style={styles.brandHeaderCount}>{section.count}</Text>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.sectionHeader, pressed && pressedDim]}
                android_ripple={ripple.onLight}
                onPress={() => toggleCategory(section.title)}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Text style={styles.sectionChevron}>{section.isOpen ? '▼' : '▶'}</Text>
                  <Text style={styles.sectionHeaderIcon}>{iconFor(section.title)}</Text>
                  <Text style={styles.sectionHeaderText}>{section.title}</Text>
                </View>
                <Text style={styles.sectionHeaderCount}>{section.count}</Text>
              </Pressable>
            )
          }
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
                <TextInput
                  style={styles.input}
                  placeholder="Company (optional, e.g. Parle, Britannia)"
                  placeholderTextColor={colors.textFaint}
                  value={editBrand}
                  onChangeText={setEditBrand}
                />
                <Text style={styles.fieldLabel}>Category</Text>
                <View style={styles.row}>
                  {ALL_CATEGORIES.map((c) => (
                    <Pressable
                      key={c}
                      style={({ pressed }) => [
                        styles.catChip,
                        editCategory === c && styles.unitChipActive,
                        pressed && pressedDim,
                      ]}
                      android_ripple={ripple.onLight}
                      onPress={() => setEditCategory(c)}
                    >
                      <Text style={[styles.unitChipText, editCategory === c && styles.unitChipTextActive]}>
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </View>
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
                <Pressable
                  style={({ pressed }) => [
                    styles.noDiscountToggle,
                    editNoDiscount && styles.noDiscountToggleActive,
                    pressed && pressedDim,
                  ]}
                  android_ripple={ripple.onLight}
                  onPress={() => setEditNoDiscount((v) => !v)}
                >
                  <Text style={styles.noDiscountToggleText}>
                    {editNoDiscount ? '☑' : '☐'} No customer discount on this item
                  </Text>
                </Pressable>
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
                    {item.noDiscount ? ' 🚫' : ''}
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

        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && pressedDim]}
          android_ripple={ripple.onLight}
          onPress={() => confirmDialog('Sign out', 'Log out of this shop account?', signOut)}
        >
          <Text style={styles.signOutBtnText}>Sign out</Text>
        </Pressable>
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
  list: { flex: 1 },
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
  topActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addToggle: { paddingVertical: 10, borderRadius: radius.sm, overflow: 'hidden' },
  addToggleText: { color: colors.brand, fontWeight: '700', fontSize: 15 },
  syncBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.brandLight,
    overflow: 'hidden',
  },
  syncBtnText: { color: colors.brandDark, fontWeight: '700', fontSize: 13 },
  signOutBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  signOutBtnText: { color: colors.textFaint, fontSize: 13, fontWeight: '600' },
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
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: 2 },
  catChip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  noDiscountToggle: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  noDiscountToggleActive: { backgroundColor: colors.brandLight, borderColor: colors.brand },
  noDiscountToggleText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.brandLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    marginTop: 10,
    marginBottom: 6,
    overflow: 'hidden',
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionChevron: { color: colors.brand, fontSize: 11 },
  sectionHeaderIcon: { fontSize: 18 },
  sectionHeaderText: { color: colors.brandDark, fontWeight: '800', fontSize: 14 },
  sectionHeaderCount: { color: colors.brand, fontWeight: '700', fontSize: 12 },
  brandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 10,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.accentAmber,
    backgroundColor: colors.bg,
  },
  brandHeaderText: { color: colors.textMuted, fontWeight: '700', fontSize: 12.5 },
  brandHeaderCount: { color: colors.textFaint, fontWeight: '600', fontSize: 11 },
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
