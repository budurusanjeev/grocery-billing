// Sends a photo of a handwritten grocery list (English / Telugu / Urdu) to
// the Gemini API free tier and gets back structured items. Traditional
// offline OCR cannot read handwritten Telugu/Urdu reliably; this can.
//
// Requires a free API key from https://aistudio.google.com in .env:
//   EXPO_PUBLIC_GEMINI_KEY=your-key-here
// Note: EXPO_PUBLIC_ vars are bundled into the client app. Fine for a
// single-shopkeeper tool; NOT safe if the app is ever distributed publicly.

export interface ScannedItem {
  name: string;
  qty: number;
  unit: string;
}

const MODEL = 'gemini-2.5-flash';

const PROMPT = `This photo shows a grocery shopping list handwritten in English, Telugu, or Urdu (possibly mixed).
Read every line item. Respond with ONLY a JSON array, no other text, in this exact shape:
[{"name": "item name in simple English (translate/transliterate if needed)", "qty": number, "unit": "kg" | "packet" | "piece" | "litre" | "dozen" | "g"}]
Rules:
- If no quantity is written for an item, use qty 1 and your best-guess unit.
- Keep names short and generic (e.g. "toor dal", "sunflower oil", "Parle-G biscuits").
- Do not invent items that are not on the paper.`;

export function hasGeminiKey(): boolean {
  return !!process.env.EXPO_PUBLIC_GEMINI_KEY;
}

export async function parseGroceryPhoto(base64: string, mimeType: string): Promise<ScannedItem[]> {
  const key = process.env.EXPO_PUBLIC_GEMINI_KEY;
  if (!key) {
    throw new Error(
      'No Gemini API key configured. Create a free key at aistudio.google.com and put it in .env as EXPO_PUBLIC_GEMINI_KEY, then restart the app.',
    );
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              { text: PROMPT },
            ],
          },
        ],
      }),
    },
  );

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err?.error?.message ?? detail;
    } catch {
      // keep the status-only message
    }
    throw new Error(`Could not read the photo: ${detail}`);
  }

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // The model is asked for bare JSON but may still wrap it in ```json fences.
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Could not find a grocery list in this photo. Try a clearer picture.');
  }

  const parsed = JSON.parse(jsonMatch[0]) as ScannedItem[];
  return parsed
    .filter((row) => row && typeof row.name === 'string' && row.name.trim())
    .map((row) => ({
      name: row.name.trim(),
      qty: typeof row.qty === 'number' && row.qty > 0 ? row.qty : 1,
      unit: typeof row.unit === 'string' ? row.unit : 'piece',
    }));
}
