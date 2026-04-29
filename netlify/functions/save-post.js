const { query } = require('./utils/db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { mediaUrl, videoUrl, thumbnailUrl, mediaType, caption } = JSON.parse(event.body || '{}');

    if (!mediaUrl) {
      return { statusCode: 400, body: JSON.stringify({ error: 'mediaUrl is required' }) };
    }

    const result = await query(
      `INSERT INTO posts (media_url, video_url, thumbnail_url, media_type, caption, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [mediaUrl, videoUrl || null, thumbnailUrl || null, mediaType || 'VIDEO', caption || '']
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post: result.rows[0] }),
    };
  } catch (err) {
    console.error('save-post error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Failed to save post' }),
    };
  }
};
