export default async function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectBase = req.headers.host.includes('localhost')
    ? 'http://localhost:3001'
    : `https://${req.headers.host}`;
  const redirectUri = `${redirectBase}/api/google/callback`;

  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/presentations',
  ].join(' ');

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&access_type=offline` +
    `&prompt=consent`;

  res.redirect(authUrl);
}
