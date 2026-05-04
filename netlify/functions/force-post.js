const { query } = require('./utils/db');
const https = require('https');

const IG_BASE = 'graph.facebook.com';
const IG_VERSION = 'v21.0';

function httpsPost(hostname, path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('JSON parse error: ' + raw)); }
      });
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
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('JSON parse error: ' + raw)); }
      });
    }).on('error', reject);
  });
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

  if (!TOKEN || !USER_ID) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing Instagram credentials' }) };
  }

  const results = [];

  for (let i = 0; i < count; i++) {
    let posts;
    try {
      posts = await query(
        `SELECT id, video_url, caption FROM posts WHERE status = 'pending' AND video_url IS NOT NULL ORDER BY created_at ASC LIMIT 1`
      );
    } catch (e) {
      results.push({ success: false, error: 'DB error: ' + e.message });
      break;
    }

    if (!posts || posts.rows.length === 0) {
      results.push({ success: false, error: 'No pending posts found' });
      break;
    }

    const post = posts.rows[0];

    await query(`UPDATE posts SET status = 'scheduled' WHERE id = $1`, [post.id]);

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

      // Step 2: Poll until FINISHED (up to 60s)
      let status = 'IN_PROGRESS';
      let attempts = 0;
      while (status !== 'FINISHED' && attempts < 20) {
        await new Promise(r => setTimeout(r, 3000));
        const pollData = await httpsGet(
          `https://${IG_BASE}/${IG_VERSION}/${containerId}?fields=status_code&access_token=${TOKEN}`
        );
        status = pollData.status_code || 'IN_PROGRESS';
        attempts++;
        if (status === 'ERROR') throw new Error('Container processing error: ' + JSON.stringify(pollData));
      }

      if (status !== 'FINISHED') throw new Error('Container timed out, status: ' + status);

      // Step 3: Publish
      const pubData = await httpsPost(IG_BASE, `/${IG_VERSION}/${USER_ID}/media_publish`, {
        creation_id: containerId,
        access_token: TOKEN,
      });
      if (!pubData.id) throw new Error(JSON.stringify(pubData));

      await query(`UPDATE posts SET status = 'posted', ig_post_id = $1, posted_at = NOW() WHERE id = $2`, [pubData.id, post.id]);
      results.push({ success: true, postId: post.id, igId: pubData.id });

    } catch (err) {
      await query(`UPDATE posts SET status = 'failed', error_message = $1 WHERE id = $2`, [err.message.substring(0, 500), post.id]);
      results.push({ success: false, postId: post.id, error: err.message.substring(0, 200) });
    }
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      message: `Posted ${succeeded} / ${count} reels. ${failed} failed.`,
      results,
    }),
  };
};
