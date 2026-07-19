import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { loadItems, type Item } from '../lib/db';
import { hasGeminiKey, parseGroceryPhoto } from '../lib/gemini';
import { matchItem } from '../lib/matcher';
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

  if (!hasGeminiKey()) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.setupTitle}>One-time setup needed</Text>
        <Text style={styles.setupText}>
          Scanning uses the free Gemini API to read handwriting (English, Telugu, Urdu).{'\n\n'}
          1. Go to aistudio.google.com and create a free API key (no card needed).{'\n'}
          2. In the project folder, create a file named .env with this line:{'\n\n'}
          EXPO_PUBLIC_GEMINI_KEY=your-key-here{'\n\n'}
          3. Restart the app.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.pickRow}>
        {Platform.OS !== 'web' && (
          <TouchableOpacity style={styles.pickBtn} onPress={() => pick(true)}>
            <Text style={styles.pickBtnText}>📷 Camera</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.pickBtn} onPress={() => pick(false)}>
          <Text style={styles.pickBtnText}>🖼 Choose Photo</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#166534" />
          <Text style={styles.loadingText}>Reading the list…</Text>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {!loading && rows.length > 0 && (
        <>
          <Text style={styles.hint}>Check the items, fix quantities, then add to bill:</Text>
          <FlatList
            style={styles.list}
            data={rows}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item: row, index }) => (
              <TouchableOpacity
                style={[styles.row, !row.match && styles.rowUnmatched]}
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
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.addBtn} onPress={addSelected}>
            <Text style={styles.addBtnText}>
              ➕ Add {rows.filter((r) => r.checked && r.match).length} items to bill
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc', padding: 12 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  setupTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  setupText: { fontSize: 14, color: '#334155', lineHeight: 22 },
  pickRow: { flexDirection: 'row', gap: 8 },
  pickBtn: {
    flex: 1,
    backgroundColor: '#0ea5e9',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  pickBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  loadingText: { color: '#334155', fontSize: 15 },
  error: { color: '#dc2626', marginTop: 12, fontSize: 14, lineHeight: 20 },
  hint: { color: '#334155', marginVertical: 10, fontSize: 14 },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    gap: 8,
  },
  rowUnmatched: { opacity: 0.6, backgroundColor: '#fef2f2' },
  check: { fontSize: 20, color: '#166534' },
  rowInfo: { flex: 1 },
  rowParsed: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  rowMatch: { fontSize: 13, color: '#166534' },
  rowNoMatch: { fontSize: 13, color: '#dc2626' },
  qtyEdit: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    minWidth: 56,
    textAlign: 'center',
    backgroundColor: '#f8fafc',
  },
  addBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  addBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
