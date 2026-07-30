// Service-role Supabase client — bypasses Row Level Security entirely.
// Every query made with this client MUST explicitly filter on
// shopkeeper_id; RLS is not a safety net here (see supabase/schema.sql).
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// createClient() throws synchronously if the URL is missing — guard it so
// the rest of the server (e.g. /api/v1/scan, which has nothing to do with
// Supabase) keeps working even before these env vars are configured.
// Only requests that actually need Supabase should fail, not the whole process.
const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

module.exports = { supabaseAdmin };
