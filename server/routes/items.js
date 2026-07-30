const express = require('express');
const { supabaseAdmin } = require('../lib/supabaseAdmin');

const router = express.Router();

const ITEM_FIELDS = ['name_en', 'name_te', 'aliases', 'category', 'brand', 'unit', 'price'];

// GET /api/v1/items — all items owned by the authenticated shopkeeper.
router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('items')
    .select('*')
    .eq('shopkeeper_id', req.shopkeeperId) // required — service role bypasses RLS
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ items: data });
});

// POST /api/v1/items — accepts one item object OR an array (so a future
// bulk-entry screen can reuse this same endpoint).
router.post('/', async (req, res) => {
  const body = Array.isArray(req.body) ? req.body : [req.body];
  const rows = body.map((raw) => {
    const row = { shopkeeper_id: req.shopkeeperId };
    for (const field of ITEM_FIELDS) {
      if (raw[field] !== undefined) row[field] = raw[field];
    }
    return row;
  });

  const invalid = rows.some((r) => !r.name_en || !r.unit || typeof r.price !== 'number');
  if (invalid) {
    return res.status(400).json({ error: 'Each item needs name_en, unit, and a numeric price.' });
  }

  const { data, error } = await supabaseAdmin.from('items').insert(rows).select('*');
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ items: data });
});

module.exports = router;
