// Netlify Function: account-info
// Returns basic info about the connected Instagram account
// Used by the frontend to verify the token is working

const https = require('https');

const IG_BASE = 'graph.facebook.com';
const IG_VERSION = 'v19.0';

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;

  if (!token || !userId) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Instagram credentials not configured' }),
    };
  }

  return new Promise((resolve) => {
    const path = `/${IG_VERSION}/${userId}?fields=id,name,username,profile_picture_url,followers_count,media_count&access_token=${token}`;

    https.get(`https://${IG_BASE}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            resolve({
              statusCode: 400,
              body: JSON.stringify({ error: parsed.error.message }),
            });
          } else {
            resolve({
              statusCode: 200,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(parsed),
            });
          }
        } catch {
          resolve({ statusCode: 500, body: JSON.stringify({ error: 'Parse error' }) });
        }
      });
    }).on('error', (err) => {
      resolve({ statusCode: 500, body: JSON.stringify({ error: err.message }) });
    });
  });
};
