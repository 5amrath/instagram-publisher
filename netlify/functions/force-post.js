const { neon } = require('@neondatabase/serverless');
const fetch = require('node-fetch');

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

  const sql = neon(process.env.DATABASE_URL);
  const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
  const USER_ID = process.env.INSTAGRAM_USER_ID;

  if (!TOKEN || !USER_ID) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing Instagram credentials' }) };
  }

  const results = [];

  for (let i = 0; i < count; i++) {
    // Pick next pending post
    let posts;
    try {
      posts = await sql`
        SELECT id, video_url, caption
        FROM posts
        WHERE status = 'pending'
          AND video_url IS NOT NULL
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;
    } catch (e) {
      results.push({ success: false, error: 'DB error: ' + e.message });
      break;
    }

    if (!posts || posts.length === 0) {
      results.push({ success: false, error: 'No pending posts found' });
      break;
    }

    const post = posts[0];

    // Mark as scheduled
    await sql`UPDATE posts SET status = 'scheduled' WHERE id = ${post.id}`;

    try {
      // Step 1: Create media container
      const createRes = await fetch(
        `https://graph.facebook.com/v19.0/${USER_ID}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            media_type: 'REELS',
            video_url: post.video_url,
            caption: post.caption || '',
            access_token: TOKEN,
          }),
        }
      );
      const createData = await createRes.json();
      if (!createData.id) throw new Error(JSON.stringify(createData));

      const containerId = createData.id;

      // Step 2: Poll until FINISHED (up to 60s)
      let status = 'IN_PROGRESS';
      let attempts = 0;
      while (status !== 'FINISHED' && attempts < 20) {
        await new Promise(r => setTimeout(r, 3000));
        const pollRes = await fetch(
          `https://graph.facebook.com/v19.0/${containerId}?fields=status_code&access_token=${TOKEN}`
        );
        const pollData = await pollRes.json();
        status = pollData.status_code || 'IN_PROGRESS';
        attempts++;
        if (status === 'ERROR') throw new Error('Container processing error');
      }

      if (status !== 'FINISHED') throw new Error('Container timed out, status: ' + status);

      // Step 3: Publish
      const pubRes = await fetch(
        `https://graph.facebook.com/v19.0/${USER_ID}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: containerId,
            access_token: TOKEN,
          }),
        }
      );
      const pubData = await pubRes.json();
      if (!pubData.id) throw new Error(JSON.stringify(pubData));

      await sql`UPDATE posts SET status = 'posted', ig_post_id = ${pubData.id}, posted_at = NOW() WHERE id = ${post.id}`;
      results.push({ success: true, postId: post.id, igId: pubData.id });

    } catch (err) {
      await sql`UPDATE posts SET status = 'failed', error_message = ${err.message} WHERE id = ${post.id}`;
      results.push({ success: false, postId: post.id, error: err.message });
    }
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ message: `Posted ${succeeded} / ${count} reels. ${failed} failed.`, results }),
  };
};
