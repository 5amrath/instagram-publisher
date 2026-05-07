const { query } = require('./utils/db');

// POST /api/schedule-day
// Body: { count?: number } — how many posts to schedule today (max 100)
// Spreads them evenly from now until end of day
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    let requestedCount = null;
    try {
      const body = JSON.parse(event.body || '{}');
      if (body.count) requestedCount = Math.min(parseInt(body.count, 10), 100);
    } catch (_) {}

    // Get daily limit from settings (now supports up to 100)
    const settingsResult = await query(`SELECT value FROM settings WHERE key = 'daily_limit'`);
    const dailyLimit = settingsResult.rows[0] ? Math.min(parseInt(settingsResult.rows[0].value, 10), 100) : 50;

    // How many have already posted today
    const todayPostedResult = await query(
      `SELECT COUNT(*) AS count FROM posts WHERE posted_at >= CURRENT_DATE`
    );
    const postedToday = parseInt(todayPostedResult.rows[0].count, 10);

    // How many are already scheduled for today (not yet posted)
    const alreadyScheduledResult = await query(
      `SELECT COUNT(*) AS count FROM posts WHERE status = 'scheduled' AND scheduled_at >= CURRENT_DATE AND scheduled_at < CURRENT_DATE + INTERVAL '1 day'`
    );
    const alreadyScheduled = parseInt(alreadyScheduledResult.rows[0].count, 10);
    const remaining = dailyLimit - postedToday - alreadyScheduled;

    if (remaining <= 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'Already at or over daily limit for today',
          postedToday, alreadyScheduled, dailyLimit, scheduled: 0,
        }),
      };
    }

    const toSchedule = requestedCount ? Math.min(requestedCount, remaining) : remaining;

    // Get next N pending posts — exclude already-posted video URLs to prevent duplicates
    const pendingResult = await query(
      `SELECT id, video_url FROM posts
       WHERE status = 'pending'
       AND video_url NOT IN (SELECT COALESCE(video_url,'') FROM posts WHERE status = 'posted' AND video_url IS NOT NULL)
       ORDER BY created_at ASC LIMIT $1`,
      [toSchedule]
    );
    const postIds = pendingResult.rows.map(r => r.id);

    if (postIds.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'No pending posts to schedule', scheduled: 0 }),
      };
    }

    // Spread evenly from 2 minutes from now to end of today
    const now = new Date();
    const startOfWindow = new Date(now.getTime() + 2 * 60 * 1000);
    const todayEnd = new Date(now);
    todayEnd.setUTCHours(23, 55, 0, 0);
    const windowEnd = new Date(Math.max(todayEnd.getTime(), startOfWindow.getTime() + postIds.length * 90 * 1000));
    const windowMs = windowEnd.getTime() - startOfWindow.getTime();
    const intervalMs = postIds.length > 1 ? Math.floor(windowMs / (postIds.length - 1)) : windowMs;
    // Minimum 90 seconds between posts (Instagram rate limit)
    const actualInterval = Math.max(intervalMs, 90 * 1000);

    const scheduledTimes = postIds.map((id, i) => ({
      id,
      time: new Date(startOfWindow.getTime() + i * actualInterval),
    }));

    let scheduled = 0;
    for (const { id, time } of scheduledTimes) {
      const result = await query(
        `UPDATE posts SET status = 'scheduled', scheduled_at = $2, error_message = NULL, container_id = NULL WHERE id = $1 AND status = 'pending'`,
        [id, time.toISOString()]
      );
      if (result.rowCount > 0) scheduled++;
    }

    const times = scheduledTimes.slice(0, scheduled).map(s => s.time.toISOString());
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: `Scheduled ${scheduled} posts for today`,
        scheduled,
        firstPost: times[0] || null,
        lastPost: times[times.length - 1] || null,
        intervalMinutes: Math.round(actualInterval / 60000),
        postedToday,
        dailyLimit,
      }),
    };
  } catch (err) {
    console.error('[schedule-day] Error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
