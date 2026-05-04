const https = require('https');

// This function exchanges a short-lived user token for a 60-day long-lived token
// then gets the permanent Page access token from it
// Requires: FACEBOOK_APP_ID, FACEBOOK_APP_SECRET env vars

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'FACEBOOK_APP_ID and FACEBOOK_APP_SECRET env vars required. Add them in Netlify environment variables.' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const shortToken = body.shortToken;
  if (!shortToken) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'shortToken required in request body' }),
    };
  }

  try {
    // Step 1: Exchange short-lived user token for long-lived user token (60 days)
    const exchangeUrl = `/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(shortToken)}`;
    const longLivedRes = await igRequest(exchangeUrl);

    if (!longLivedRes.access_token) {
      throw new Error('Failed to get long-lived token: ' + JSON.stringify(longLivedRes));
    }

    const longLivedToken = longLivedRes.access_token;
    const expiresIn = longLivedRes.expires_in; // ~5184000 seconds = 60 days

    // Step 2: Get Page token using the long-lived user token (Page tokens are permanent)
    const pagesRes = await igRequest(`/v21.0/me/accounts?fields=access_token,name,id&access_token=${longLivedToken}`);

    if (!pagesRes.data || !pagesRes.data.length) {
      throw new Error('No pages found. Make sure your Facebook account has a Page linked.');
    }

    const pageToken = pagesRes.data[0].access_token;
    const pageName = pagesRes.data[0].name;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Got permanent Page token for "${pageName}". Update INSTAGRAM_ACCESS_TOKEN in Netlify env vars.`,
        pageToken,
        pageName,
        longLivedToken,
        expiresInDays: Math.round(expiresIn / 86400),
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

function igRequest(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'graph.facebook.com',
      path,
      method: 'GET',
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Bad response: ' + data.substring(0, 100))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}
