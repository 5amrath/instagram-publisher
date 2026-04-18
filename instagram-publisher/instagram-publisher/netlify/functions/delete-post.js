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

  const { id } = body;
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'id is required' }) };
  }

  try {
    const result = await query(
      `DELETE FROM posts WHERE id = $1 AND status IN ('pending', 'failed') RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Post not found or cannot be deleted (already posted/scheduled)' }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, deletedId: id }),
    };
  } catch (err) {
    console.error('delete-post error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
