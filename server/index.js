// Grocery-billing backend: one job only — accept a photo of a handwritten
// grocery list and ask Gemini to read it, keeping the API key on the server
// so it never ships inside the public website/app bundle.
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
// Photos arrive as base64 inside JSON, so the default 100kb limit is too small.
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 5050;

const SCAN_PROMPT = `This photo shows a grocery shopping list handwritten in English, Telugu, or Urdu (possibly mixed).
Read every line item. Respond with ONLY a JSON array, no other text, in this exact shape:
[{"name": "item name in simple English (translate/transliterate if needed)", "qty": number, "unit": "kg" | "packet" | "piece" | "litre" | "dozen" | "g"}]
Rules:
- If no quantity is written for an item, use qty 1 and your best-guess unit.
- Keep names short and generic (e.g. "toor dal", "sunflower oil", "Parle-G biscuits").
- Do not invent items that are not on the paper.`;

app.get('/health', (req, res) => {
  res.json({ status: 'OK', geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY) });
});

app.post('/api/v1/scan', async (req, res) => {
  const { image, mimeType } = req.body || {};

  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Missing image (base64 string) in request body.' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mimeType || 'image/jpeg', data: image } },
                { text: SCAN_PROMPT },
              ],
            },
          ],
        }),
      },
    );

    if (!geminiRes.ok) {
      let detail = `HTTP ${geminiRes.status}`;
      try {
        const err = await geminiRes.json();
        detail = (err && err.error && err.error.message) || detail;
      } catch (e) {
        // keep status-only message
      }
      return res.status(502).json({ error: `Could not read the photo: ${detail}` });
    }

    const data = await geminiRes.json();
    const text =
      (data &&
        data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0] &&
        data.candidates[0].content.parts[0].text) ||
      '';

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res
        .status(422)
        .json({ error: 'Could not find a grocery list in this photo. Try a clearer picture.' });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const items = (Array.isArray(parsed) ? parsed : [])
      .filter((row) => row && typeof row.name === 'string' && row.name.trim())
      .map((row) => ({
        name: row.name.trim(),
        qty: typeof row.qty === 'number' && row.qty > 0 ? row.qty : 1,
        unit: typeof row.unit === 'string' ? row.unit : 'piece',
      }));

    return res.status(200).json({ items });
  } catch (error) {
    console.error('Scan error:', error);
    return res.status(500).json({ error: 'Internal error reading the photo.' });
  }
});

app.listen(PORT, () => {
  console.log(`Grocery scan server listening on port ${PORT}`);
});
