const { query } = require('./utils/db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const [counts, todayCount, settings] = await Promise.all([
      query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled,
          COUNT(*) FILTER (WHERE status = 'posted') AS posted,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed,
          COUNT(*) AS total
        FROM posts
      `),
      query(`SELECT COUNT(*) AS count FROM posts WHERE posted_at >= CURRENT_DATE`),
      query(`SELECT value FROM settings WHERE key = 'daily_limit'`),
    ]);

    const stats = counts.rows[0];
    const dailyLimit = settings.rows[0] ? parseInt(settings.rows[0].value, 10) : 25;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pending: parseInt(stats.pending, 10),
        scheduled: parseInt(stats.scheduled, 10),
        posted: parseInt(stats.posted, 10),
        failed: parseInt(stats.failed, 10),
        total: parseInt(stats.total, 10),
        postedToday: parseInt(todayCount.rows[0].count, 10),
        dailyLimit,
      }),
    };
  } catch (err) {
    console.error('get-queue-stats error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
