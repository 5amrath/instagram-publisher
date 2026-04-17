const { query } = require('./utils/db');

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

  const { mediaUrl, caption } = body;

  if (!mediaUrl || typeof mediaUrl !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'mediaUrl is required' }) };
  }

  try {
    const result = await query(
      `INSERT INTO posts (media_url, caption, status) VALUES ($1, $2, 'pending') RETURNING *`,
      [mediaUrl, caption || '']
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result.rows[0]),
    };
  } catch (err) {
    console.error('save-post error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
