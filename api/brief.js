import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.VITE_ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { advisor_name, conversation } = req.body;

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: `You are summarizing a conversation between Meghan and ${advisor_name}. Extract the key decisions, insights, context, and action items in a concise briefing memo that other advisors need to know. Write it as: BRIEFING FROM ${advisor_name.toUpperCase()} — ${today}. Keep it under 200 words. Be specific.`,
      messages: [{ role: 'user', content: conversation }],
    });

    const memoContent = response.content?.[0]?.text || 'No memo generated.';

    const { data, error } = await supabase
      .from('council_memos')
      .insert({ from_advisor: advisor_name, content: memoContent })
      .select()
      .single();

    if (error) {
      console.error('Supabase memo write error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    console.error('Memo generation error:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
}
