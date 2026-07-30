const { supabaseAdmin } = require('../lib/supabaseAdmin');

// Reads `Authorization: Bearer <access_token>`, validates it against
// Supabase Auth, and attaches the shopkeeper's user id to the request.
async function requireShopkeeper(req, res, next) {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase is not configured on this server.' });
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header.' });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }

  req.shopkeeperId = data.user.id;
  next();
}

module.exports = { requireShopkeeper };
