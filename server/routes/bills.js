const express = require('express');
const { supabaseAdmin } = require('../lib/supabaseAdmin');

const router = express.Router();

// POST /api/v1/bills — accepts one bill object OR an array. Upserts on `id`
// (the client's own local bill id, a timestamp string) so tapping "Upload"
// repeatedly is safe and never creates duplicate rows.
router.post('/', async (req, res) => {
  const body = Array.isArray(req.body) ? req.body : [req.body];

  const rows = body.map((raw) => ({
    id: raw.id,
    shopkeeper_id: req.shopkeeperId,
    created_at: raw.created_at,
    lines: raw.lines,
    total: raw.total,
    payment_method: raw.paymentMethod ?? null,
  }));

  const invalid = rows.some(
    (r) => !r.id || !r.created_at || !Array.isArray(r.lines) || typeof r.total !== 'number',
  );
  if (invalid) {
    return res.status(400).json({ error: 'Each bill needs id, created_at, lines[], and a numeric total.' });
  }

  const { data, error } = await supabaseAdmin
    .from('bills')
    .upsert(rows, { onConflict: 'id' })
    .select('id');

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ uploaded: data.length });
});

module.exports = router;