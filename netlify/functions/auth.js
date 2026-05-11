// Simple auth - checks SITE_PASSWORD env var
// Returns JWT-like token stored in localStorage

const crypto = require('crypto');

const SITE_PASSWORD = process.env.SITE_PASSWORD || 'ascend2024';
const SECRET = process.env.AUTH_SECRET || 'ascend-publisher-secret-key-2024';

function makeToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  return data + '.' + sig;
}

function verifyToken(token) {
  try {
    const [data, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, password, token } = body;

    if (action === 'login') {
      if (password !== SITE_PASSWORD) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Wrong password' }) };
      }
      // Token expires in 30 days
      const tok = makeToken({ role: 'admin', exp: Date.now() + 30 * 24 * 60 * 60 * 1000 });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, token: tok }) };
    }

    if (action === 'verify') {
      const payload = verifyToken(token || '');
      if (!payload) return { statusCode: 401, headers, body: JSON.stringify({ valid: false }) };
      return { statusCode: 200, headers, body: JSON.stringify({ valid: true, payload }) };
    }

    if (action === 'change-password') {
      // Can only change via env var update, this just validates current
      const payload = verifyToken(token || '');
      if (!payload) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, note: 'Update SITE_PASSWORD env var in Netlify to change password' }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
