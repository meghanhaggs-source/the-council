import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.VITE_ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { system, messages, model = 'claude-sonnet-4-20250514', max_tokens = 4096 } = req.body;

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens,
      system,
      messages,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
        },
      ],
    });

    // Extract all text blocks from the response (web search responses
    // return multiple content blocks — text interspersed with search results)
    const textParts = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text);

    const combinedText = textParts.join('\n\n');

    // Return in the same shape the frontend expects
    res.json({
      ...response,
      content: [{ type: 'text', text: combinedText }],
    });
  } catch (err) {
    console.error('Anthropic error:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
}
