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
  // Some low-margin staples stay excluded from customer-type discounts even
  // for retailer/wholesaler bills — set on the catalog item so it applies
  // automatically every time it's billed, without the shopkeeper having to
  // remember it per sale.
  noDiscount?: boolean;
}

export interface BillLine {
  itemId: string;
  name: string;
  unit: Unit;
  price: number;
  qty: number;
  // Copied from the item at the moment it's added to the bill, so a bill
  // already in progress isn't affected by a later catalog edit.
  noDiscount?: boolean;
}

export type PaymentMethod = 'cash' | 'upi' | 'card';

export type CustomerType = 'regular' | 'retailer' | 'wholesaler';

// Single source of truth for the discount tiers — used to render the
// selector chips and to compute the discount amount for a bill.
export const CUSTOMER_TYPES: { key: CustomerType; label: string; discountPercent: number }[] = [
  { key: 'regular', label: 'Regular', discountPercent: 0 },
  { key: 'retailer', label: 'Retailer', discountPercent: 5 },
  { key: 'wholesaler', label: 'Wholesaler', discountPercent: 10 },
];

export function discountPercentFor(customerType: CustomerType): number {
  return CUSTOMER_TYPES.find((c) => c.key === customerType)?.discountPercent ?? 0;
}

export interface Bill {
  id: string;
  created_at: string;
  lines: BillLine[];
  total: number;
  paymentMethod?: PaymentMethod;
  customerType?: CustomerType;
  // Rupee amount knocked off the subtotal (0 if none) — stored so history
  // and receipts can show the breakdown without recomputing it later.
  discount?: number;
  // Optional — collected at checkout for the receipt/records, not required
  // to complete a sale.
  customerName?: string;
  customerMobile?: string;
  // Human-readable receipt number: YYMM + a 3-digit counter that resets
  // each month (e.g. "2608001" = the 1st bill in August 2026). Separate
  // from `id`, which stays a timestamp-based string used as the actual
  // storage/sync key — this is just what's shown to the customer. Optional
  // because bills saved before this feature existed don't have one.
  billNumber?: string;
}

export interface QrCode {
  id: string;
  label: string;
  // A data URI (data:image/jpeg;base64,...) so it works identically on web
  // and native without depending on a cache file surviving app restarts.
  imageUri: string;
}

// A shop has one receipt printer, not a list — unlike QR codes there's no
// need to choose between several at checkout time. Either a Bluetooth
// device (paired via Android Settings) or a WiFi/network printer
// (discovered on the local subnet), both printed to via the same
// ESC/POS-style formatting in src/lib/printer.ts.
export type PrinterDevice =
  | { type: 'bluetooth'; name: string; address: string }
  | { type: 'network'; name: string; host: string; port: number };

const ITEMS_KEY = 'gb_items_v1';
const BILLS_KEY = 'gb_bills_v1';
const QRCODES_KEY = 'gb_qrcodes_v1';
const PRINTER_KEY = 'gb_printer_v1';
const BILLNUM_KEY = 'gb_billnum_v1';
const DEVICE_LABEL_KEY = 'gb_device_label_v1';
export const MAX_QRCODES = 10;

// A short name for this specific device (e.g. "PC", "Phone 1"), set once
// via the Receipt Printer screen. Only meaningful when a shop bills from
// more than one device — see nextBillNumber below.
export async function getDeviceLabel(): Promise<string> {
  const raw = await AsyncStorage.getItem(DEVICE_LABEL_KEY);
  return raw ?? '';
}

export async function setDeviceLabel(label: string): Promise<void> {
  await AsyncStorage.setItem(DEVICE_LABEL_KEY, label.trim());
}

// YY (year) + DD (day of month) + a 3-digit counter, resetting to 001 every
// calendar day — e.g. "2604001" for the 1st bill on the 4th of the month.
// Note this repeats across different months on the same day-of-month (the
// 4th of August and the 4th of September both start with "2604") — the
// counter resets by full date internally, only the displayed prefix omits
// the month.
//
// The counter itself is per-device (each phone/PC counts its own bills
// independently), so for a shop billing from more than one device, a
// device label set via setDeviceLabel is appended (e.g. "2604001-PC" vs
// "2604001-Phone1") so numbers from different devices can never collide.
// No label set (the common single-device case) means no suffix at all.
//
// Pure formatting, no storage access — split out so it can be unit-tested
// directly instead of only through the AsyncStorage-backed counter below.
export function formatBillNumber(date: Date, count: number, deviceLabel: string): string {
  const yy = String(date.getFullYear()).slice(-2);
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}${dd}${String(count).padStart(3, '0')}${deviceLabel ? `-${deviceLabel}` : ''}`;
}

function billDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

async function nextBillNumber(date: Date): Promise<string> {
  const dayKey = billDayKey(date);
  const raw = await AsyncStorage.getItem(BILLNUM_KEY);
  const state: { dayKey: string; count: number } = raw ? JSON.parse(raw) : { dayKey: '', count: 0 };
  const count = state.dayKey === dayKey ? state.count + 1 : 1;
  await AsyncStorage.setItem(BILLNUM_KEY, JSON.stringify({ dayKey, count }));
  const label = await getDeviceLabel();
  return formatBillNumber(date, count, label);
}

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

export interface SaveBillOptions {
  paymentMethod?: PaymentMethod;
  customerType?: CustomerType;
  discount?: number;
  customerName?: string;
  customerMobile?: string;
}

export async function saveBill(lines: BillLine[], total: number, options: SaveBillOptions = {}): Promise<Bill> {
  const now = new Date();
  const bill: Bill = {
    id: `${Date.now()}`,
    created_at: now.toISOString(),
    lines,
    total,
    paymentMethod: options.paymentMethod,
    customerType: options.customerType,
    discount: options.discount,
    customerName: options.customerName?.trim() || undefined,
    customerMobile: options.customerMobile?.trim() || undefined,
    billNumber: await nextBillNumber(now),
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

export async function loadQrCodes(): Promise<QrCode[]> {
  const raw = await AsyncStorage.getItem(QRCODES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveQrCodes(qrCodes: QrCode[]): Promise<void> {
  await AsyncStorage.setItem(QRCODES_KEY, JSON.stringify(qrCodes));
}

export async function addQrCode(qr: Omit<QrCode, 'id'>): Promise<QrCode[]> {
  const existing = await loadQrCodes();
  if (existing.length >= MAX_QRCODES) {
    throw new Error(`You can save up to ${MAX_QRCODES} QR codes.`);
  }
  const next = [...existing, { ...qr, id: `qr-${Date.now()}` }];
  await AsyncStorage.setItem(QRCODES_KEY, JSON.stringify(next));
  return next;
}

export async function removeQrCode(id: string): Promise<QrCode[]> {
  const existing = await loadQrCodes();
  const next = existing.filter((q) => q.id !== id);
  await AsyncStorage.setItem(QRCODES_KEY, JSON.stringify(next));
  return next;
}

export async function loadPrinter(): Promise<PrinterDevice | null> {
  const raw = await AsyncStorage.getItem(PRINTER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function savePrinter(printer: PrinterDevice): Promise<void> {
  await AsyncStorage.setItem(PRINTER_KEY, JSON.stringify(printer));
}

export async function forgetPrinter(): Promise<void> {
  await AsyncStorage.removeItem(PRINTER_KEY);
}
