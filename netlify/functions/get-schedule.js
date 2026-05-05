const { query } = require('./utils/db');

// GET /api/get-schedule
// Returns today's scheduled posts with their scheduled_at times
exports.handler = async (event) => {
  try {
    // Get all scheduled posts for today, ordered by scheduled_at
    const result = await query(`
      SELECT id, caption, scheduled_at, status, thumbnail_url
      FROM posts
      WHERE status = 'scheduled'
        AND scheduled_at >= CURRENT_DATE
        AND scheduled_at < CURRENT_DATE + INTERVAL '1 day'
      ORDER BY scheduled_at ASC
    `);

    const nextResult = await query(`
      SELECT scheduled_at FROM posts
      WHERE status = 'scheduled' AND scheduled_at > NOW()
      ORDER BY scheduled_at ASC LIMIT 1
    `);

    const nextPost = nextResult.rows[0]?.scheduled_at || null;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        scheduled: result.rows,
        count: result.rows.length,
        nextPost,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
