import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const app = express();
const port = 3001;

const anthropic = new Anthropic({ apiKey: process.env.VITE_ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// ── Chat with Anthropic (web search enabled) ──
app.post('/api/chat', async (req, res) => {
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

    const textParts = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text);

    const combinedText = textParts.join('\n\n');

    res.json({
      ...response,
      content: [{ type: 'text', text: combinedText }],
    });
  } catch (err) {
    console.error('Anthropic error:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Get conversation history for an advisor ──
app.get('/api/conversations', async (req, res) => {
  const advisor = req.query.advisor;
  if (!advisor) return res.status(400).json({ error: 'advisor query param required' });

  const { data, error } = await supabase
    .from('conversations')
    .select('role, content, created_at')
    .eq('advisor_name', advisor)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Supabase read error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// ── Save a message ──
app.post('/api/conversations', async (req, res) => {
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

  res.json(data);
});

// ── Clear conversation history for an advisor ──
app.delete('/api/conversations', async (req, res) => {
  const advisor = req.query.advisor;
  if (!advisor) return res.status(400).json({ error: 'advisor query param required' });

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('advisor_name', advisor);

  if (error) {
    console.error('Supabase delete error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json({ ok: true });
});

// ── Get all council memos ──
app.get('/api/memos', async (req, res) => {
  const { data, error } = await supabase
    .from('council_memos')
    .select('from_advisor, content, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Supabase memo read error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// ── Generate and save a briefing memo ──
app.post('/api/brief', async (req, res) => {
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
});

// ── List available ElevenLabs voices (debug) ──
app.get('/api/voices', async (req, res) => {
  const apiKey = process.env.VITE_ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured' });
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[voices] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Text to Speech via ElevenLabs ──
app.post('/api/tts', async (req, res) => {
  const { text, voiceId } = req.body;

  if (!text || !voiceId) {
    return res.status(400).json({ error: 'text and voiceId are required' });
  }

  const apiKey = process.env.VITE_ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured' });
  }

  try {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const arrayBuffer = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('[TTS] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`[council] API server running on http://localhost:${port}`);
});
