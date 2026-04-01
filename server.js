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

// ── Google OAuth: Start auth flow ──
app.get('/api/google/auth', (req, res) => {
  const redirectUri = `http://localhost:${port}/api/google/callback`;

  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/presentations',
  ].join(' ');

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${process.env.GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&access_type=offline` +
    `&prompt=consent`;

  res.redirect(authUrl);
});

// ── Google OAuth: Handle callback ──
app.get('/api/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No authorization code received');

  const redirectUri = `http://localhost:${port}/api/google/callback`;

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) {
      return res.status(400).json({ error: tokens.error_description });
    }

    const expiresAt = Date.now() + tokens.expires_in * 1000;

    await supabase.from('google_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('google_tokens').insert({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
    });

    res.send(`
      <html>
        <body style="background:#1a1a1a;color:#d4af37;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center">
            <h1>Google Drive Connected</h1>
            <p>You can close this window and return to The Council.</p>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Google Drive: Check connection status ──
app.get('/api/google/status', async (req, res) => {
  const { data } = await supabase
    .from('google_tokens')
    .select('expires_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  res.json({ connected: !!data });
});

// ── Google Drive: Get valid token (with refresh) ──
async function getValidToken() {
  const { data } = await supabase
    .from('google_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!data) throw new Error('No Google tokens found. Connect Google Drive first.');

  if (Date.now() > data.expires_at - 60000) {
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: data.refresh_token,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    });

    const newTokens = await refreshRes.json();
    if (newTokens.error) throw new Error('Failed to refresh Google token');

    const expiresAt = Date.now() + newTokens.expires_in * 1000;

    await supabase
      .from('google_tokens')
      .update({ access_token: newTokens.access_token, expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq('id', data.id);

    return newTokens.access_token;
  }

  return data.access_token;
}

// ── Google Drive: Find or create folder ──
async function findOrCreateFolder(token, name, parentId = null) {
  let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) query += ` and '${parentId}' in parents`;

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });

  const folder = await createRes.json();
  return folder.id;
}

// ── Google Drive: Create document or sheet ──
app.post('/api/google/create-doc', async (req, res) => {
  const { title, content, advisorName, type = 'doc' } = req.body;

  if (!title || !content || !advisorName) {
    return res.status(400).json({ error: 'title, content, and advisorName required' });
  }

  try {
    const token = await getValidToken();

    const councilFolderId = await findOrCreateFolder(token, 'The Council');
    const advisorFolderId = await findOrCreateFolder(token, advisorName, councilFolderId);

    if (type === 'sheet') {
      const sheetRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties: { title } }),
      });

      const sheet = await sheetRes.json();

      await fetch(`https://www.googleapis.com/drive/v3/files/${sheet.spreadsheetId}?addParents=${advisorFolderId}&removeParents=root`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (content) {
        const rows = content.split('\n').map(row => row.split('\t'));
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheet.spreadsheetId}/values/Sheet1!A1?valueInputOption=RAW`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: rows }),
        });
      }

      return res.json({
        id: sheet.spreadsheetId,
        url: sheet.spreadsheetUrl,
        type: 'sheet',
      });
    }

    // Create Google Doc
    const docRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: title,
        mimeType: 'application/vnd.google-apps.document',
        parents: [advisorFolderId],
      }),
    });

    const doc = await docRes.json();

    await fetch(`https://docs.googleapis.com/v1/documents/${doc.id}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{ insertText: { location: { index: 1 }, text: content } }],
      }),
    });

    res.json({
      id: doc.id,
      url: `https://docs.google.com/document/d/${doc.id}/edit`,
      type: 'doc',
    });
  } catch (err) {
    console.error('Google Drive error:', err);
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

// ── Astro transit calculations (Swiss Ephemeris) ──
app.get('/api/astro', async (req, res) => {
  try {
    const { default: handler } = await import('./api/astro.js');
    await handler(req, res);
  } catch (err) {
    console.error('Astro error:', err);
    res.status(500).json({ error: err.message });
  }
});
