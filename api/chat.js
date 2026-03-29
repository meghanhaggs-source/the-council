import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.VITE_ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { system, messages, model = 'claude-sonnet-4-20250514', max_tokens = 1024 } = req.body;

  try {
    const response = await anthropic.messages.create({ model, max_tokens, system, messages });
    res.json(response);
  } catch (err) {
    console.error('Anthropic error:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
}
