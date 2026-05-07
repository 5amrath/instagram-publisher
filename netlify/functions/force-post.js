const { query } = require('./utils/db');
const https = require('https');
const IG_BASE = 'graph.facebook.com';
const IG_VERSION = 'v21.0';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function igPost(path, params) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(params).toString();
    const req = https.request({
      hostname: IG_BASE,
      path: `/${IG_VERSION}${path}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(raw);
          if (p.error) reject(new Error(p.error.message || JSON.stringify(p.error)));
          else resolve(p);
        } catch { reject(new Error('Bad IG response: ' + raw.slice(0, 100))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('IG timeout')); });
    req.write(body);
    req.end();
  });
}

function igGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: IG_BASE,
      path: `/${IG_VERSION}${path}`,
      method: 'GET',
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(raw);
          if (p.error) reject(new Error(p.error.message || JSON.stringify(p.error)));
          else resolve(p);
        } catch { reject(new Error('Bad IG response: ' + raw.slice(0, 100))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('IG get timeout')); });
    req.end();
  });
}

async function postOneNow(token, userId, post) {
  try {
    // DEDUP CHECK: verify this video_url hasn't already been posted
    const dupCheck = await query(
      `SELECT id FROM posts WHERE video_url = $1 AND status = 'posted' AND id != $2 LIMIT 1`,
      [post.video_url, post.id]
    );
    if (dupCheck.rows.length > 0) {
      // Mark as duplicate-skip so it won't be picked again
      await query(`UPDATE posts SET status = 'failed', error_message = 'Duplicate video URL - already posted' WHERE id = $1`, [post.id]);
      return { success: false, postId: post.id, error: 'Duplicate video - skipped' };
    }

    const containerRes = await igPost(`/${userId}/media`, {
      media_type: 'REELS',
      video_url: post.video_url,
      caption: post.caption || '',
      access_token: token,
    });
    if (!containerRes.id) throw new Error('No container ID: ' + JSON.stringify(containerRes));
    const cid = containerRes.id;
    await query('UPDATE posts SET container_id = $1 WHERE id = $2', [cid, post.id]);

    let statusCode = 'IN_PROGRESS';
    for (let i = 0; i < 6; i++) {
      await sleep(3000);
      try {
        const s = await igGet(`/${cid}?fields=status_code&access_token=${token}`);
        statusCode = s.status_code || 'IN_PROGRESS';
        if (statusCode === 'FINISHED' || statusCode === 'ERROR') break;
      } catch (_) {}
    }

    if (statusCode === 'ERROR') {
      await query(`UPDATE posts SET status = 'failed', error_message = 'Container error' WHERE id = $1`, [post.id]);
      return { success: false, postId: post.id, error: 'Instagram container processing failed' };
    }
    if (statusCode !== 'FINISHED') {
      await query(`UPDATE posts SET status = 'scheduled', scheduled_at = NOW() WHERE id = $1`, [post.id]);
      return { success: null, postId: post.id, note: 'Container processing — auto-post will publish in ~2 min' };
    }

    const pubRes = await igPost(`/${userId}/media_publish`, { creation_id: cid, access_token: token });
    if (!pubRes.id) throw new Error('No IG post ID: ' + JSON.stringify(pubRes));
    await query(
      `UPDATE posts SET status = 'posted', ig_post_id = $1, posted_at = NOW(), container_id = NULL WHERE id = $2`,
      [pubRes.id, post.id]
    );
    return { success: true, postId: post.id, igId: pubRes.id };
  } catch (err) {
    await query(`UPDATE posts SET status = 'pending', container_id = NULL WHERE id = $1`, [post.id]).catch(() => {});
    return { success: false, postId: post.id, error: err.message.slice(0, 200) };
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let count = 1;
  try {
    const b = JSON.parse(event.body || '{}');
    count = Math.min(Math.max(parseInt(b.count) || 1, 1), 100);
  } catch (_) {}

  const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
  const USER_ID = process.env.INSTAGRAM_USER_ID;
  if (!TOKEN || !USER_ID) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing credentials' }) };

  let dailyLimit = 50;
  let postedToday = 0;
  try {
    const limRes = await query(`SELECT value FROM settings WHERE key = 'daily_limit'`);
    if (limRes.rows[0]) dailyLimit = Math.min(parseInt(limRes.rows[0].value, 10), 100);
    const todayRes = await query(`SELECT COUNT(*) AS count FROM posts WHERE posted_at >= CURRENT_DATE`);
    postedToday = parseInt(todayRes.rows[0].count, 10);
  } catch (_) {}

  const remaining = dailyLimit - postedToday;
  if (remaining <= 0) {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'Daily limit reached', results: [] }) };
  }
  count = Math.min(count, remaining);

  const results = [];

  // Phase 1: Flush any FINISHED containers from previous runs
  try {
    const stuck = await query(
      `SELECT id, container_id FROM posts WHERE status = 'scheduled' AND container_id IS NOT NULL LIMIT 10`
    );
    for (const p of stuck.rows) {
      try {
        const pd = await igGet(`/${p.container_id}?fields=status_code&access_token=${TOKEN}`);
        if (pd.status_code === 'FINISHED') {
          const pub = await igPost(`/${USER_ID}/media_publish`, { creation_id: p.container_id, access_token: TOKEN });
          if (pub.id) {
            await query(`UPDATE posts SET status = 'posted', ig_post_id = $1, posted_at = NOW(), container_id = NULL WHERE id = $2`, [pub.id, p.id]);
            results.push({ success: true, postId: p.id, igId: pub.id, note: 'flushed existing container' });
          }
        } else if (pd.status_code === 'ERROR') {
          await query(`UPDATE posts SET status = 'failed', error_message = 'Container error', container_id = NULL WHERE id = $1`, [p.id]);
        }
      } catch (_) {}
    }
  } catch (_) {}

  const alreadyDone = results.filter(r => r.success === true).length;
  const needed = Math.max(0, count - alreadyDone);
  if (needed === 0) {
    const ok = results.filter(r => r.success === true).length;
    return { statusCode: 200, headers, body: JSON.stringify({ message: `${ok} posted from queue flush`, results }) };
  }

  // Phase 2: Pick N pending posts, EXCLUDING already-posted video URLs (dedup)
  let pendingPosts = [];
  try {
    const pr = await query(
      `SELECT id, video_url, caption FROM posts
       WHERE status = 'pending'
       AND video_url IS NOT NULL
       AND video_url NOT IN (SELECT COALESCE(video_url,'') FROM posts WHERE status = 'posted' AND video_url IS NOT NULL)
       ORDER BY created_at ASC LIMIT $1`,
      [needed]
    );
    pendingPosts = pr.rows;
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'DB error: ' + err.message, results }) };
  }

  if (pendingPosts.length === 0) {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'No pending posts with video URLs (duplicates removed)', results }) };
  }

  const now = Date.now();
  for (let i = 0; i < pendingPosts.length; i++) {
    const post = pendingPosts[i];
    const schedTime = new Date(now + i * 90 * 1000);
    await query(
      `UPDATE posts SET status = 'scheduled', scheduled_at = $2, container_id = NULL WHERE id = $1`,
      [post.id, schedTime.toISOString()]
    ).catch(() => {});
  }

  // Post the FIRST one right now
  const firstPost = pendingPosts[0];
  const firstResult = await postOneNow(TOKEN, USER_ID, firstPost);
  results.push(firstResult);

  // Posts 2-N: already stamped with scheduled_at
  for (let i = 1; i < pendingPosts.length; i++) {
    const post = pendingPosts[i];
    const schedTime = new Date(now + i * 90 * 1000);
    const minsFromNow = Math.round(i * 1.5);
    results.push({ success: null, postId: post.id, note: `Scheduled — posts in ~${minsFromNow} min`, scheduledAt: schedTime.toISOString() });
  }

  const ok = results.filter(r => r.success === true).length;
  const proc = results.filter(r => r.success === null).length;
  const fail = results.filter(r => r.success === false).length;
  return {
    statusCode: 200, headers,
    body: JSON.stringify({ message: `${ok} posted now · ${proc} scheduled · ${fail} failed`, results }),
  };
};
