const { query } = require('./utils/db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const result = await query(
      `UPDATE posts SET status = 'pending', retry_count = 0, error_message = NULL WHERE status = 'failed' RETURNING id`
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retriedCount: result.rowCount }),
    };
  } catch (err) {
    console.error('retry-failed error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
