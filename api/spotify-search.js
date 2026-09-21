const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SEARCH_URL = 'https://api.spotify.com/v1/search';

let cachedToken = null;
let tokenExpiresAt = 0;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res.end(JSON.stringify(body));
}

async function spotifyToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const error = new Error('Spotify credentials are not configured on the resolver.');
    error.statusCode = 503;
    throw error;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const error = new Error('Spotify token request failed.');
    error.statusCode = 502;
    throw error;
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (Number(data.expires_in) || 3600) * 1000;
  return cachedToken;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { error: 'Use POST.' });

  const body = req.body || {};
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const type = body.type === 'album' ? 'album' : 'track';
  if (!query) return json(res, 400, { error: 'A song or album query is required.' });
  if (query.length > 200) return json(res, 400, { error: 'Query is too long.' });

  try {
    const token = await spotifyToken();
    const url = new URL(SEARCH_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('type', type);
    url.searchParams.set('limit', '1');
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return json(res, 502, { error: 'Spotify search failed.' });

    const data = await response.json();
    const item = type === 'album' ? data.albums?.items?.[0] : data.tracks?.items?.[0];
    const link = item?.external_urls?.spotify || null;
    if (!link) return json(res, 404, { error: 'No Spotify match found.' });

    return json(res, 200, {
      url: link,
      type,
      name: item.name,
      artist: type === 'track' ? item.artists?.[0]?.name || '' : item.artists?.[0]?.name || ''
    });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.message || 'Resolver failed.' });
  }
};
