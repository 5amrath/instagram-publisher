const { query } = require('./utils/db');

const ALLOWED_LIMITS = [10, 15, 20, 25, 30, 40, 50];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { key, value } = body;

  if (key === 'daily_limit') {
    const num = parseInt(value, 10);
    if (!ALLOWED_LIMITS.includes(num)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `daily_limit must be one of: ${ALLOWED_LIMITS.join(', ')}` }),
      };
    }
  }

  if (!key || value === undefined) {
    return { statusCode: 400, body: JSON.stringify({ error: 'key and value are required' }) };
  }

  try {
    await query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, String(value)]
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, key, value: String(value) }),
    };
  } catch (err) {
    console.error('update-settings error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
