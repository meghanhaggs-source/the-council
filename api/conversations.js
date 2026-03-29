import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // GET /api/conversations?advisor=Name — load history
  if (req.method === 'GET') {
    const advisor = req.query.advisor;
    if (!advisor) {
      return res.status(400).json({ error: 'advisor query param required' });
    }

    const { data, error } = await supabase
      .from('conversations')
      .select('role, content, created_at')
      .eq('advisor_name', advisor)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase read error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  }

  // POST /api/conversations — save a message
  if (req.method === 'POST') {
    const { advisor_name, role, content } = req.body;

    const { data, error } = await supabase
      .from('conversations')
      .insert({ advisor_name, role, content })
      .select()
      .single();

    if (error) {
      console.error('Supabase write error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  }

  // DELETE /api/conversations?advisor=Name — clear history
  if (req.method === 'DELETE') {
    const advisor = req.query.advisor;
    if (!advisor) {
      return res.status(400).json({ error: 'advisor query param required' });
    }

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('advisor_name', advisor);

    if (error) {
      console.error('Supabase delete error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
