import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { data } = await supabase
    .from('google_tokens')
    .select('expires_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  res.json({ connected: !!data });
}
