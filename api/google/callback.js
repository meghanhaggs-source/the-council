import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).send('No authorization code received');

  const redirectBase = req.headers.host.includes('localhost')
    ? 'http://localhost:3001'
    : `https://${req.headers.host}`;
  const redirectUri = `${redirectBase}/api/google/callback`;

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

    // Delete any existing tokens and store new ones
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
}
