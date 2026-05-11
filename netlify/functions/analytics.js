const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const action = event.queryStringParameters?.action || 'overview';

    if (action === 'overview') {
      // Posts per day for last 30 days
      const dailyRes = await pool.query(`
        SELECT DATE(created_at) as day, COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'posted') as posted,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
        FROM posts
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day ASC
      `);

      // Total stats
      const statsRes = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'posted') as posted,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as this_week,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') as today
        FROM posts
      `);

      // Posting hours distribution
      const hoursRes = await pool.query(`
        SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
        FROM posts WHERE status = 'posted'
        GROUP BY hour ORDER BY hour
      `);

      // Top captions (most recent posted)
      const topPostsRes = await pool.query(`
        SELECT id, caption, thumbnail_url, video_url, created_at
        FROM posts WHERE status = 'posted'
        ORDER BY created_at DESC LIMIT 10
      `);

      return { statusCode: 200, headers, body: JSON.stringify({
        daily: dailyRes.rows,
        stats: statsRes.rows[0],
        hours: hoursRes.rows,
        topPosts: topPostsRes.rows,
      })};
    }

    if (action === 'velocity') {
      // Posts per hour today
      const res = await pool.query(`
        SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
        FROM posts
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY hour ORDER BY hour
      `);
      return { statusCode: 200, headers, body: JSON.stringify({ hourly: res.rows }) };
    }

    if (action === 'queue-health') {
      const res = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
          COUNT(*) FILTER (WHERE status = 'posted') as posted_today,
          COUNT(*) FILTER (WHERE status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours') as failed_today,
          MIN(scheduled_at) FILTER (WHERE status = 'scheduled') as next_post
        FROM posts
        WHERE created_at >= NOW() - INTERVAL '24 hours' OR status IN ('pending','scheduled')
      `);
      return { statusCode: 200, headers, body: JSON.stringify(res.rows[0]) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('analytics error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
