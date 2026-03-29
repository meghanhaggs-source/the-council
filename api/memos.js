import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // GET /api/memos — load all memos
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('council_memos')
      .select('from_advisor, content, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase memo read error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  }

  // POST /api/memos — generate and save a briefing (just saves, brief.js generates)
  return res.status(405).json({ error: 'Use /api/brief to generate memos' });
}
