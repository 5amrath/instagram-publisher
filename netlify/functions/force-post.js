const { query } = require('./utils/db');
const https = require('https');

const IG_BASE = 'graph.facebook.com';
const IG_VERSION = 'v21.0';

function httpsPost(hostname, path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = https.request(
      { hostname, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => { let raw = ''; res.on('data', c => raw += c); res.on('end', () => { try { resolve(JSON.parse(raw)); } catch(e) { reject(new Error(raw.slice(0,300))); } }); }
    );
    req.on('error', reject); req.write(body); req.end();
  });
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => { let raw = ''; res.on('data', c => raw += c); res.on('end', () => { try { resolve(JSON.parse(raw)); } catch(e) { reject(new Error(raw.slice(0,300))); } }); }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function postOne(token, userId) {
  // Pick next pending post
  const rows = await query(
    `SELECT id, video_url, caption FROM posts WHERE status = 'pending' AND video_url IS NOT NULL ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`
  );
  if (!rows.rows.length) return null;
  const post = rows.rows[0];

  await query(`UPDATE posts SET status = 'scheduled', scheduled_at = NOW() WHERE id = $1`, [post.id]);

  // Create container
  const createData = await httpsPost(IG_BASE, `/${IG_VERSION}/${userId}/media`, {
    media_type: 'REELS', video_url: post.video_url, caption: post.caption || '', access_token: token,
  });
  if (!createData.id) throw new Error(JSON.stringify(createData));
  const cid = createData.id;

  await query(`UPDATE posts SET container_id = $1 WHERE id = $2`, [cid, post.id]);

  // Poll up to 50s
  let status = 'IN_PROGRESS';
  for (let i = 0; i < 10; i++) {
    await sleep(5000);
    const p = await httpsGet(`https://${IG_BASE}/${IG_VERSION}/${cid}?fields=status_code&access_token=${token}`);
    status = p.status_code || 'IN_PROGRESS';
    if (status === 'FINISHED' || status === 'ERROR') break;
  }

  if (status !== 'FINISHED') {
    // Leave as scheduled - auto-post will finish it
    return { postId: post.id, status: 'processing', note: 'Container processing, will auto-publish' };
  }

  // Publish
  const pub = await httpsPost(IG_BASE, `/${IG_VERSION}/${userId}/media_publish`, {
    creation_id: cid, access_token: token,
  });
  if (!pub.id) throw new Error(JSON.stringify(pub));
  await query(`UPDATE posts SET status = 'posted', ig_post_id = $1, posted_at = NOW() WHERE id = $2`, [pub.id, post.id]);
  return { postId: post.id, igId: pub.id, status: 'posted' };
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let count = 1;
  try { const b = JSON.parse(event.body || '{}'); count = Math.min(Math.max(parseInt(b.count)||1,1),50); } catch(_){}

  const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
  const USER_ID = process.env.INSTAGRAM_USER_ID;
  if (!TOKEN || !USER_ID) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing credentials' }) };

  const results = [];

  // First: flush any already-FINISHED containers from previous runs
  try {
    const stuck = await query(`SELECT id, container_id FROM posts WHERE status = 'scheduled' AND container_id IS NOT NULL AND scheduled_at < NOW() - INTERVAL '20 seconds' LIMIT 20`);
    for (const p of stuck.rows) {
      try {
        const pd = await httpsGet(`https://${IG_BASE}/${IG_VERSION}/${p.container_id}?fields=status_code&access_token=${TOKEN}`);
        if (pd.status_code === 'FINISHED') {
          const pub = await httpsPost(IG_BASE, `/${IG_VERSION}/${USER_ID}/media_publish`, { creation_id: p.container_id, access_token: TOKEN });
          if (pub.id) {
            await query(`UPDATE posts SET status = 'posted', ig_post_id = $1, posted_at = NOW() WHERE id = $2`, [pub.id, p.id]);
            results.push({ success: true, postId: p.id, igId: pub.id, note: 'flushed' });
          }
        } else if (pd.status_code === 'ERROR') {
          await query(`UPDATE posts SET status = 'failed', error_message = 'Container error' WHERE id = $1`, [p.id]);
        }
      } catch(_) {}
    }
  } catch(_) {}

  // Post 'count' new reels, each with a 60s gap enforced server-side
  const needed = Math.max(0, count - results.filter(r=>r.success).length);
  for (let i = 0; i < needed; i++) {
    try {
      const r = await postOne(TOKEN, USER_ID);
      if (!r) { results.push({ success: false, error: 'No pending posts' }); break; }
      if (r.status === 'posted') results.push({ success: true, postId: r.postId, igId: r.igId });
      else results.push({ success: null, postId: r.postId, note: r.note });
    } catch(err) {
      results.push({ success: false, error: err.message.slice(0,200) });
    }

    // 60s gap between posts (skip after last one)
    if (i < needed - 1 && results[results.length-1]?.success !== false) {
      await sleep(60000);
    }
  }

  const ok = results.filter(r=>r.success===true).length;
  const proc = results.filter(r=>r.success===null).length;
  const fail = results.filter(r=>r.success===false).length;

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ message: `${ok} posted · ${proc} processing · ${fail} failed`, results }),
  };
};
