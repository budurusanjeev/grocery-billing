import AsyncStorage from '@react-native-async-storage/async-storage';
import seedData from '../catalog/seed.json';

export type Unit = 'kg' | 'packet' | 'piece' | 'litre' | 'dozen';

export interface Item {
  id: string;
  name_en: string;
  name_te: string;
  aliases: string[];
  category: string;
  brand: string | null;
  unit: Unit;
  price: number;
}

export interface BillLine {
  itemId: string;
  name: string;
  unit: Unit;
  price: number;
  qty: number;
}

export interface Bill {
  id: string;
  created_at: string;
  lines: BillLine[];
  total: number;
}

const ITEMS_KEY = 'gb_items_v1';
const BILLS_KEY = 'gb_bills_v1';

// AsyncStorage is used instead of sqlite so the exact same code runs on
// Android and web (localStorage) with zero extra config. The catalog is
// ~100 rows, well within what key-value storage handles comfortably. If
// this ever outgrows that, only this file needs to change.

export async function loadItems(): Promise<Item[]> {
  const raw = await AsyncStorage.getItem(ITEMS_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as Item[];
    } catch {
      // fall through to reseed
    }
  }
  const items = seedData as Item[];
  await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  return items;
}

export async function saveItems(items: Item[]): Promise<void> {
  await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

export async function updateItem(updated: Item): Promise<Item[]> {
  const items = await loadItems();
  const next = items.map((it) => (it.id === updated.id ? updated : it));
  await saveItems(next);
  return next;
}

export async function addItem(item: Item): Promise<Item[]> {
  const items = await loadItems();
  const next = [...items, item];
  await saveItems(next);
  return next;
}

export async function saveBill(lines: BillLine[], total: number): Promise<Bill> {
  const bill: Bill = {
    id: `${Date.now()}`,
    created_at: new Date().toISOString(),
    lines,
    total,
  };
  const raw = await AsyncStorage.getItem(BILLS_KEY);
  const bills: Bill[] = raw ? JSON.parse(raw) : [];
  bills.unshift(bill);
  // Keep the last 200 bills; a kirana counter doesn't need unbounded history on-device.
  await AsyncStorage.setItem(BILLS_KEY, JSON.stringify(bills.slice(0, 200)));
  return bill;
}

export async function getBills(): Promise<Bill[]> {
  const raw = await AsyncStorage.getItem(BILLS_KEY);
  return raw ? JSON.parse(raw) : [];
}
