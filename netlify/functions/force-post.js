const { query } = require('./utils/db');
const https = require('https');

const IG_BASE = 'graph.facebook.com';
const IG_VERSION = 'v21.0';

function httpsPost(hostname, path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = {
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch(e) { reject(new Error(raw.substring(0,200))); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch(e) { reject(new Error(raw.substring(0,200))); } });
    }).on('error', reject);
  });
}

// Try to publish a container that is already FINISHED
async function tryPublish(containerId, postId, token, userId) {
  const pubData = await httpsPost(IG_BASE, `/${IG_VERSION}/${userId}/media_publish`, {
    creation_id: containerId,
    access_token: token,
  });
  if (!pubData.id) throw new Error(JSON.stringify(pubData));
  await query(`UPDATE posts SET status = 'posted', ig_post_id = $1, posted_at = NOW() WHERE id = $2`, [pubData.id, postId]);
  return pubData.id;
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
    const body = JSON.parse(event.body || '{}');
    count = Math.min(Math.max(parseInt(body.count) || 1, 1), 50);
  } catch (_) {}

  const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
  const USER_ID = process.env.INSTAGRAM_USER_ID;
  if (!TOKEN || !USER_ID) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing Instagram credentials' }) };

  const results = [];

  // PHASE 1: pick up any stuck 'scheduled' posts that already have a container_id and try to publish them
  try {
    const stuck = await query(
      `SELECT id, container_id FROM posts WHERE status = 'scheduled' AND container_id IS NOT NULL AND scheduled_at < NOW() - INTERVAL '30 seconds' LIMIT 10`
    );
    for (const p of (stuck.rows || [])) {
      try {
        // Check container status
        const pollData = await httpsGet(
          `https://${IG_BASE}/${IG_VERSION}/${p.container_id}?fields=status_code&access_token=${TOKEN}`
        );
        if (pollData.status_code === 'FINISHED') {
          const igId = await tryPublish(p.container_id, p.id, TOKEN, USER_ID);
          results.push({ success: true, postId: p.id, igId, note: 'published stuck container' });
        } else if (pollData.status_code === 'ERROR') {
          await query(`UPDATE posts SET status = 'failed', error_message = 'Container error' WHERE id = $1`, [p.id]);
          results.push({ success: false, postId: p.id, error: 'Container error' });
        }
        // else still processing — leave it
      } catch(e) {
        // ignore per-post errors in cleanup phase
      }
    }
  } catch(_) {}

  // PHASE 2: pick new pending posts, create containers (fire-and-forget style)
  const needed = Math.max(0, count - results.filter(r => r.success).length);

  for (let i = 0; i < needed; i++) {
    let posts;
    try {
      posts = await query(
        `SELECT id, video_url, caption FROM posts WHERE status = 'pending' AND video_url IS NOT NULL ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`
      );
    } catch (e) {
      results.push({ success: false, error: 'DB error: ' + e.message });
      break;
    }

    if (!posts || posts.rows.length === 0) {
      results.push({ success: false, error: 'No pending posts' });
      break;
    }

    const post = posts.rows[0];

    try {
      // Step 1: Create Reels container
      const createData = await httpsPost(IG_BASE, `/${IG_VERSION}/${USER_ID}/media`, {
        media_type: 'REELS',
        video_url: post.video_url,
        caption: post.caption || '',
        access_token: TOKEN,
      });

      if (!createData.id) throw new Error(JSON.stringify(createData));

      const containerId = createData.id;

      // Mark as scheduled + save container_id so auto-post can finish the job
      await query(
        `UPDATE posts SET status = 'scheduled', container_id = $1, scheduled_at = NOW() WHERE id = $2`,
        [containerId, post.id]
      );

      // Step 3: Quick poll — try up to 8x3s = 24s (just under timeout)
      let status = 'IN_PROGRESS';
      for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise(r => setTimeout(r, 3000));
        const pollData = await httpsGet(
          `https://${IG_BASE}/${IG_VERSION}/${containerId}?fields=status_code&access_token=${TOKEN}`
        );
        status = pollData.status_code || 'IN_PROGRESS';
        if (status === 'FINISHED' || status === 'ERROR') break;
      }

      if (status === 'FINISHED') {
        // Publish immediately
        const pubData = await httpsPost(IG_BASE, `/${IG_VERSION}/${USER_ID}/media_publish`, {
          creation_id: containerId,
          access_token: TOKEN,
        });
        if (!pubData.id) throw new Error('Publish failed: ' + JSON.stringify(pubData));
        await query(`UPDATE posts SET status = 'posted', ig_post_id = $1, posted_at = NOW() WHERE id = $2`, [pubData.id, post.id]);
        results.push({ success: true, postId: post.id, igId: pubData.id });
      } else if (status === 'ERROR') {
        await query(`UPDATE posts SET status = 'failed', error_message = 'Container error' WHERE id = $1`, [post.id]);
        results.push({ success: false, postId: post.id, error: 'Container processing error' });
      } else {
        // Still processing — container saved, auto-post will finish it next run
        results.push({ success: null, postId: post.id, containerId, note: 'Container created, still processing — will auto-publish within 10 min' });
      }

    } catch (err) {
      await query(`UPDATE posts SET status = 'failed', error_message = $1 WHERE id = $2`, [err.message.substring(0, 500), post.id]);
      results.push({ success: false, postId: post.id, error: err.message.substring(0, 200) });
    }
  }

  const succeeded = results.filter(r => r.success === true).length;
  const processing = results.filter(r => r.success === null).length;
  const failed = results.filter(r => r.success === false).length;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      message: `${succeeded} posted now · ${processing} processing (will auto-publish) · ${failed} failed`,
      results,
    }),
  };
};
