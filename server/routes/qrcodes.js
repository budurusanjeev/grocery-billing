const express = require('express');
const { supabaseAdmin } = require('../lib/supabaseAdmin');

const router = express.Router();

// GET /api/v1/qrcodes -- all QR codes owned by the authenticated shopkeeper.
router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('qr_codes')
    .select('*')
    .eq('shopkeeper_id', req.shopkeeperId) // required -- service role bypasses RLS
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ qrCodes: data });
});

// POST /api/v1/qrcodes -- accepts one QR code object OR an array. Upserts on
// `id` (the client's own local id) so re-syncing repeatedly is safe.
router.post('/', async (req, res) => {
  const body = Array.isArray(req.body) ? req.body : [req.body];
  const rows = body.map((raw) => ({
    id: raw.id,
    shopkeeper_id: req.shopkeeperId,
    label: raw.label,
    image_uri: raw.imageUri,
  }));

  const invalid = rows.some((r) => !r.id || !r.label || !r.image_uri);
  if (invalid) {
    return res.status(400).json({ error: 'Each QR code needs id, label, and imageUri.' });
  }

  const { data, error } = await supabaseAdmin
    .from('qr_codes')
    .upsert(rows, { onConflict: 'id' })
    .select('*');

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ qrCodes: data });
});

// DELETE /api/v1/qrcodes/:id -- removes one QR code, scoped to the caller's
// own rows so one shopkeeper can never delete another's.
router.delete('/:id', async (req, res) => {
  const { error } = await supabaseAdmin
    .from('qr_codes')
    .delete()
    .eq('id', req.params.id)
    .eq('shopkeeper_id', req.shopkeeperId);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).end();
});

module.exports = router;