import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function getValidToken() {
  const { data } = await supabase
    .from('google_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!data) throw new Error('No Google tokens found. Please connect Google Drive first.');

  // Refresh if expired
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

async function findOrCreateFolder(token, name, parentId = null) {
  // Search for existing folder
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

  // Create folder
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, content, advisorName, type = 'doc' } = req.body;

  if (!title || !content || !advisorName) {
    return res.status(400).json({ error: 'title, content, and advisorName required' });
  }

  try {
    const token = await getValidToken();

    // Create folder structure: The Council / AdvisorName
    const councilFolderId = await findOrCreateFolder(token, 'The Council');
    const advisorFolderId = await findOrCreateFolder(token, advisorName, councilFolderId);

    if (type === 'sheet') {
      // Create Google Sheet
      const sheetRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: { title },
        }),
      });

      const sheet = await sheetRes.json();

      // Move to advisor folder
      await fetch(`https://www.googleapis.com/drive/v3/files/${sheet.spreadsheetId}?addParents=${advisorFolderId}&removeParents=root`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });

      // Add content as first sheet data if provided
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

    // Add content to the doc
    const requests = [
      {
        insertText: {
          location: { index: 1 },
          text: content,
        },
      },
    ];

    await fetch(`https://docs.googleapis.com/v1/documents/${doc.id}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
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
}
