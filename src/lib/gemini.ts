// Sends a photo of a handwritten grocery list (English / Telugu / Urdu) to
// our own backend, which calls the Gemini API server-side. The API key
// lives only on the server (GEMINI_API_KEY env var on Render) — it is never
// bundled into this app, so nothing secret ships to the browser or phone.
//
// Backend endpoint: school-bus-backend repo, POST /api/v1/grocery/scan

export interface ScannedItem {
  name: string;
  qty: number;
  unit: string;
}

const SCAN_ENDPOINT = 'https://school-bus-backend-2.onrender.com/api/v1/grocery/scan';

export async function parseGroceryPhoto(base64: string, mimeType: string): Promise<ScannedItem[]> {
  const res = await fetch(SCAN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64, mimeType }),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err?.error ?? detail;
    } catch {
      // keep the status-only message
    }
    throw new Error(detail);
  }

  const data = await res.json();
  const items = Array.isArray(data?.items) ? (data.items as ScannedItem[]) : [];
  return items.filter((row) => row && typeof row.name === 'string' && row.name.trim());
}
