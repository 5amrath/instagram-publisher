const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('Parse error: ' + raw.substring(0, 200))); }
      });
    }).on('error', reject);
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const APP_ID = process.env.FACEBOOK_APP_ID;
  const APP_SECRET = process.env.FACEBOOK_APP_SECRET;

  if (!APP_ID || !APP_SECRET) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'FACEBOOK_APP_ID and FACEBOOK_APP_SECRET env vars not set' }),
    };
  }

  let shortLivedToken = '';
  try {
    const body = JSON.parse(event.body || '{}');
    shortLivedToken = (body.token || '').trim();
  } catch (_) {}

  // If no token provided, try to use a self-refresh with the current page token
  // by exchanging it using the app credentials
  if (!shortLivedToken) {
    const currentToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!currentToken) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No token provided and no current token set' }) };
    }
    shortLivedToken = currentToken;
  }

  try {
    // Step 1: Exchange for a long-lived user token (60 days)
    const exchangeUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortLivedToken}`;
    const exchangeData = await httpsGet(exchangeUrl);

    if (exchangeData.error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Token exchange failed: ' + JSON.stringify(exchangeData.error) }),
      };
    }

    const longLivedUserToken = exchangeData.access_token;
    const expiresIn = exchangeData.expires_in; // seconds

    // Step 2: Get Page access token from me/accounts
    const accountsUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=access_token,name,id&access_token=${longLivedUserToken}`;
    const accountsData = await httpsGet(accountsUrl);

    if (accountsData.error || !accountsData.data || accountsData.data.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Failed to get page token: ' + JSON.stringify(accountsData) }),
      };
    }

    // Find the Ascend Deals page
    const page = accountsData.data.find(p => p.name && p.name.toLowerCase().includes('ascend')) || accountsData.data[0];
    const pageToken = page.access_token;
    const pageName = page.name;

    const expiryDays = expiresIn ? Math.round(expiresIn / 86400) : 60;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        pageToken,
        pageName,
        longLivedUserToken,
        expiresInDays: expiryDays,
        message: `Got ${expiryDays}-day token for ${pageName}. Copy the pageToken and update INSTAGRAM_ACCESS_TOKEN in Netlify, then redeploy.`,
        allPages: accountsData.data.map(p => ({ name: p.name, id: p.id })),
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
