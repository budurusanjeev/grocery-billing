import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { loadItems, type Item } from '../lib/db';
import { parseGroceryPhoto } from '../lib/gemini';
import { matchItem } from '../lib/matcher';
import { requireInternet } from '../lib/network';
import { cardShadow, colors, pressedDim, radius, ripple, spacing } from '../lib/theme';
import { formatMoney, showMessage } from '../lib/ui';
import { useBill } from '../state/bill';

interface ScanRow {
  checked: boolean;
  parsedName: string;
  qty: number;
  match: Item | null;
}

export default function ScanScreen() {
  const router = useRouter();
  const { addLine } = useBill();
  const [items, setItems] = useState<Item[]>([]);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadItems().then(setItems);
  }, []);

  const processImage = async (base64: string, mimeType: string) => {
    if (!(await requireInternet())) return;
    setLoading(true);
    setError(null);
    setRows([]);
    try {
      const scanned = await parseGroceryPhoto(base64, mimeType);
      if (scanned.length === 0) {
        setError('No items found in the photo. Try a clearer picture.');
        return;
      }
      setRows(
        scanned.map((s) => {
          const match = matchItem(s.name, items);
          return { checked: match !== null, parsedName: s.name, qty: s.qty, match };
        }),
      );
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong reading the photo.');
    } finally {
      setLoading(false);
    }
  };

  const pick = async (useCamera: boolean) => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      base64: true,
      quality: 0.7,
    };
    const result = useCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const asset = result.assets[0];
    await processImage(asset.base64!, asset.mimeType ?? 'image/jpeg');
  };

  const addSelected = () => {
    const usable = rows.filter((r) => r.checked && r.match);
    if (usable.length === 0) {
      showMessage('Nothing selected', 'Tick at least one matched item.');
      return;
    }
    for (const row of usable) {
      addLine(row.match!, row.qty);
    }
    // After a browser refresh there is no history, so "back" has nowhere
    // to go — fall back to the billing screen directly.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <ScreenContainer>
      <View style={styles.screen}>
        <View style={styles.pickRow}>
          {Platform.OS !== 'web' && (
            <Pressable
              style={({ pressed }) => [styles.pickBtn, pressed && pressedDim]}
              android_ripple={ripple.onDark}
              onPress={() => pick(true)}
            >
              <Text style={styles.pickBtnText}>📷 Camera</Text>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [styles.pickBtn, pressed && pressedDim]}
            android_ripple={ripple.onDark}
            onPress={() => pick(false)}
          >
            <Text style={styles.pickBtnText}>🖼 Choose Photo</Text>
          </Pressable>
        </View>

        {!loading && rows.length === 0 && !error && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🧾</Text>
            <Text style={styles.emptyText}>
              Take or choose a photo of a handwritten grocery list — items get matched to the
              catalog automatically, and you confirm before anything's added.
            </Text>
          </View>
        )}

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={styles.loadingText}>
              Reading the list… (the first scan of the day can take up to a minute while the server
              wakes up)
            </Text>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        {!loading && rows.length > 0 && (
          <>
            <Text style={styles.hint}>Check the items, fix quantities, then add to bill:</Text>
            <FlatList
              style={styles.list}
              contentContainerStyle={styles.listContent}
              data={rows}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item: row, index }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.row,
                    !row.match && styles.rowUnmatched,
                    pressed && pressedDim,
                  ]}
                  android_ripple={ripple.onLight}
                  onPress={() =>
                    row.match &&
                    setRows((prev) =>
                      prev.map((r, i) => (i === index ? { ...r, checked: !r.checked } : r)),
                    )
                  }
                >
                  <Text style={styles.check}>{row.checked ? '☑' : '☐'}</Text>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowParsed}>{row.parsedName}</Text>
                    {row.match ? (
                      <Text style={styles.rowMatch}>
                        → {row.match.name_en} · {formatMoney(row.match.price)}/{row.match.unit}
                      </Text>
                    ) : (
                      <Text style={styles.rowNoMatch}>Not in catalog — add it from Prices screen</Text>
                    )}
                  </View>
                  <TextInput
                    style={styles.qtyEdit}
                    defaultValue={String(row.qty)}
                    keyboardType="numeric"
                    onEndEditing={(e) => {
                      const q = parseFloat(e.nativeEvent.text);
                      if (!isNaN(q) && q > 0) {
                        setRows((prev) => prev.map((r, i) => (i === index ? { ...r, qty: q } : r)));
                      }
                    }}
                  />
                </Pressable>
              )}
            />
            <Pressable
              style={({ pressed }) => [styles.addBtn, pressed && pressedDim]}
              android_ripple={ripple.onDark}
              onPress={addSelected}
            >
              <Text style={styles.addBtnText}>
                ➕ Add {rows.filter((r) => r.checked && r.match).length} items to bill
              </Text>
            </Pressable>
          </>
        )}
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
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  pickRow: { flexDirection: 'row', gap: 8 },
  pickBtn: {
    flex: 1,
    backgroundColor: colors.accentBlue,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    overflow: 'hidden',
    ...cardShadow,
  },
  pickBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  emptyBox: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 40, marginBottom: 10, opacity: 0.5 },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  loadingText: { color: '#334155', fontSize: 15, textAlign: 'center' },
  error: { color: colors.accentRed, marginTop: 12, fontSize: 14, lineHeight: 20 },
  hint: { color: '#334155', marginVertical: 10, fontSize: 14 },
  list: { flex: 1 },
  listContent: { paddingBottom: spacing.listBottom },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 7,
    gap: 8,
    overflow: 'hidden',
    ...cardShadow,
  },
  rowUnmatched: { opacity: 0.7, backgroundColor: '#fef2f2' },
  check: { fontSize: 20, color: colors.brand },
  rowInfo: { flex: 1 },
  rowParsed: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowMatch: { fontSize: 13, color: colors.brand },
  rowNoMatch: { fontSize: 13, color: colors.accentRed },
  qtyEdit: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    minWidth: 56,
    textAlign: 'center',
    backgroundColor: colors.bg,
  },
  addBtn: {
    backgroundColor: '#16a34a',
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    overflow: 'hidden',
    ...cardShadow,
  },
  addBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
