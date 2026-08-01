import {
  getBills,
  loadItems,
  loadQrCodes,
  MAX_QRCODES,
  saveItems,
  saveQrCodes,
  type Item,
  type QrCode,
  type Unit,
} from './db';
import { supabase } from './supabase';

const ITEMS_URL = process.env.EXPO_PUBLIC_ITEMS_URL ?? 'http://localhost:5050/api/v1/items';
const BILLS_URL = process.env.EXPO_PUBLIC_BILLS_URL ?? 'http://localhost:5050/api/v1/bills';
const QRCODES_URL = process.env.EXPO_PUBLIC_QRCODES_URL ?? 'http://localhost:5050/api/v1/qrcodes';

interface ServerItemRow {
  id: string;
  name_en: string;
  name_te: string | null;
  aliases: string[] | null;
  category: string;
  brand: string | null;
  unit: Unit;
  price: number | string;
}

function toLocalItem(row: ServerItemRow): Item {
  return {
    id: row.id,
    name_en: row.name_en,
    name_te: row.name_te ?? '',
    aliases: row.aliases ?? [],
    category: row.category,
    brand: row.brand ?? null,
    unit: row.unit,
    price: Number(row.price),
  };
}

export interface SyncResult<T = Item> {
  added: number;
  items: T[];
}

// Pulls every item the shopkeeper has added on the server (e.g. via a future
// web bulk-entry screen) and appends any not already present locally,
// matched by id. Deliberately append-only: never overwrites a local price
// or category edit, and only ever runs when explicitly called — there is no
// automatic/background sync anywhere in this app.
export async function fetchAndMergeNewItems(): Promise<SyncResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Please log in first.');
  }

  const res = await fetch(ITEMS_URL, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body?.error ?? detail;
    } catch {
      // keep the status-only message
    }
    throw new Error(detail);
  }

  const body = await res.json();
  const serverRows: ServerItemRow[] = Array.isArray(body?.items) ? body.items : [];

  const local = await loadItems();
  const localIds = new Set(local.map((it) => it.id));
  const fresh = serverRows.map(toLocalItem).filter((it) => !localIds.has(it.id));

  if (fresh.length === 0) {
    return { added: 0, items: local };
  }

  const merged = [...local, ...fresh];
  await saveItems(merged);
  return { added: fresh.length, items: merged };
}

// Pushes every locally-saved bill (up to the last 200 kept on-device) up to
// the server, on demand via a dedicated button — never automatically. Safe
// to tap repeatedly: the server upserts on the bill's own local id, so
// re-uploading never creates duplicate rows.
export async function uploadBills(): Promise<{ uploaded: number }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Please log in first.');
  }

  const bills = await getBills();
  if (bills.length === 0) {
    return { uploaded: 0 };
  }

  const res = await fetch(BILLS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(bills),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body?.error ?? detail;
    } catch {
      // keep the status-only message
    }
    throw new Error(detail);
  }

  const body = await res.json();
  return { uploaded: typeof body?.uploaded === 'number' ? body.uploaded : bills.length };
}

interface ServerQrRow {
  id: string;
  label: string;
  image_uri: string;
}

function toLocalQrCode(row: ServerQrRow): QrCode {
  return { id: row.id, label: row.label, imageUri: row.image_uri };
}

// Pushes every locally-saved QR code up to the server, then pulls down any
// QR codes saved from a different device and merges them in (append-only,
// matched by id — never overwrites a local edit). Run together so tapping
// one "Sync" button reconciles both directions; on-demand only, same as
// items and bills — there is no automatic/background sync anywhere in this app.
export async function syncQrCodes(): Promise<SyncResult<QrCode>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Please log in first.');
  }
  const authHeader = { Authorization: `Bearer ${session.access_token}` };

  const local = await loadQrCodes();
  if (local.length > 0) {
    const pushRes = await fetch(QRCODES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify(local),
    });
    if (!pushRes.ok) {
      let detail = `HTTP ${pushRes.status}`;
      try {
        const body = await pushRes.json();
        detail = body?.error ?? detail;
      } catch {
        // keep the status-only message
      }
      throw new Error(detail);
    }
  }

  const pullRes = await fetch(QRCODES_URL, { headers: authHeader });
  if (!pullRes.ok) {
    let detail = `HTTP ${pullRes.status}`;
    try {
      const body = await pullRes.json();
      detail = body?.error ?? detail;
    } catch {
      // keep the status-only message
    }
    throw new Error(detail);
  }

  const pullBody = await pullRes.json();
  const serverRows: ServerQrRow[] = Array.isArray(pullBody?.qrCodes) ? pullBody.qrCodes : [];

  const localIds = new Set(local.map((qr) => qr.id));
  const fresh = serverRows.map(toLocalQrCode).filter((qr) => !localIds.has(qr.id));

  if (fresh.length === 0) {
    return { added: 0, items: local };
  }

  // A device that's behind on syncing shouldn't silently lose the newest
  // codes off the end — keep the most recent MAX_QRCODES overall rather
  // than truncating what just arrived from the server.
  const merged = [...local, ...fresh].slice(-MAX_QRCODES);
  await saveQrCodes(merged);
  return { added: fresh.length, items: merged };
}

// Best-effort: removes a QR code from the server too, so it doesn't come
// back on the next sync from another device. Never throws — deleting
// locally must still succeed even if the shopkeeper is offline or logged out.
export async function deleteQrCodeRemote(id: string): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(`${QRCODES_URL}/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    // offline or server unreachable — the local delete already went through
  }
}
