const { query } = require('./utils/db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const params = event.queryStringParameters || {};
  const status = params.status || null;
  const limit = Math.min(parseInt(params.limit, 10) || 50, 200);
  const offset = parseInt(params.offset, 10) || 0;

  try {
    let sql, values;

    if (status) {
      sql = `SELECT * FROM posts WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
      values = [status, limit, offset];
    } else {
      sql = `SELECT * FROM posts ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
      values = [limit, offset];
    }

    const result = await query(sql, values);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posts: result.rows }),
    };
  } catch (err) {
    console.error('get-posts error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
