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

  const { mediaUrl, videoUrl, thumbnailUrl, caption, mediaType } = body;
  const url = videoUrl || mediaUrl;

  if (!url || typeof url !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'mediaUrl or videoUrl is required' }) };
  }

  const type = mediaType || (videoUrl ? 'VIDEO' : 'IMAGE');

  try {
    const result = await query(
      `INSERT INTO posts (media_url, thumbnail_url, caption, status, media_type)
       VALUES ($1, $2, $3, 'pending', $4) RETURNING *`,
      [url, thumbnailUrl || null, caption || '', type]
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result.rows[0]),
    };
  } catch (err) {
    console.error('save-post error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
