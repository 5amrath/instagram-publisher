const { query } = require('./utils/db');
const { generateCaption } = require('./utils/ai');
const https = require('https');

const IG_BASE = 'graph.facebook.com';
const IG_VERSION = 'v21.0';

// Netlify scheduled function — runs every 10 minutes
exports.handler = async (event) => {
  console.log('[auto-post] Worker triggered at', new Date().toISOString());

  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;

  if (!token || !userId) {
    console.error('[auto-post] Missing INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_USER_ID');
    return { statusCode: 500, body: 'Missing Instagram credentials' };
  }

  let post = null;

  try {
    // 1. Check daily limit
    const settingsResult = await query(`SELECT value FROM settings WHERE key = 'daily_limit'`);
    const dailyLimit = settingsResult.rows[0] ? parseInt(settingsResult.rows[0].value, 10) : 25;

    const todayResult = await query(`SELECT COUNT(*) AS count FROM posts WHERE posted_at >= CURRENT_DATE`);
    const postedToday = parseInt(todayResult.rows[0].count, 10);

    if (postedToday >= dailyLimit) {
      console.log(`[auto-post] Daily limit reached (${postedToday}/${dailyLimit}). Exiting.`);
      return { statusCode: 200, body: JSON.stringify({ message: 'Daily limit reached', postedToday, dailyLimit }) };
    }

    // 2. Atomic lock: claim one pending post
    const lockResult = await query(`
      UPDATE posts
      SET status = 'scheduled'
      WHERE id = (
        SELECT id FROM posts
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `);

    if (lockResult.rowCount === 0) {
      console.log('[auto-post] No pending posts. Exiting.');
      return { statusCode: 200, body: JSON.stringify({ message: 'No pending posts' }) };
    }

    post = lockResult.rows[0];
    console.log(`[auto-post] Processing post ${post.id}`);

    // 3. Generate AI caption if empty
    let caption = post.caption;
    if (!caption || caption.trim() === '') {
      console.log('[auto-post] No caption, generating with AI...');
      caption = await generateCaption();
    }

    // 4. Create Instagram media container
    const containerParams = new URLSearchParams({
      image_url: post.media_url,
      caption,
      access_token: token,
    });

    const containerRes = await igRequest(`/${userId}/media?${containerParams}`, 'POST');
    const containerId = containerRes.id;

    if (!containerId) {
      throw new Error('No container ID returned from Instagram');
    }

    // 5. Wait for container to be ready
    await waitForContainer(containerId, token);

    // 6. Publish
    const publishRes = await igRequest(
      `/${userId}/media_publish?creation_id=${containerId}&access_token=${token}`,
      'POST'
    );

    // 7. Mark as posted
    await query(
      `UPDATE posts SET status = 'posted', posted_at = NOW(), caption = $2, ig_post_id = $3 WHERE id = $1`,
      [post.id, caption, publishRes.id || null]
    );

    console.log(`[auto-post] Successfully posted ${post.id} -> IG ${publishRes.id}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Posted successfully', postId: post.id, igId: publishRes.id }),
    };

  } catch (err) {
    console.error('[auto-post] Error:', err.message);

    // Failure handling — retry up to 2 times, then mark failed
    // post is defined in the outer try scope if we got past the lock query
    if (post && post.id) {
      try {
        await query(
          `UPDATE posts
           SET retry_count = retry_count + 1,
               error_message = $2,
               status = CASE WHEN retry_count >= 2 THEN 'failed' ELSE 'pending' END
           WHERE id = $1`,
          [post.id, err.message]
        );
      } catch (dbErr) {
        console.error('[auto-post] Failed to update post status:', dbErr.message);
      }
    }

    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

async function igRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: IG_BASE,
      path: `/${IG_VERSION}${path}`,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed);
        } catch (e) {
          reject(new Error('Invalid response from Instagram API'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Instagram API timeout')); });
    req.end();
  });
}

async function waitForContainer(containerId, token, maxAttempts = 15) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await igRequest(
      `/${containerId}?fields=status_code&access_token=${token}`
    );
    if (status.status_code === 'FINISHED') return;
    if (status.status_code === 'ERROR') throw new Error('Instagram media container processing failed');
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Container timed out during processing');
}
