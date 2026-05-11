const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = event.path || '';
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (method === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    // Ensure tiktok_posts table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tiktok_posts (
        id SERIAL PRIMARY KEY,
        tiktok_id TEXT UNIQUE,
        author TEXT,
        caption TEXT,
        video_url TEXT,
        thumbnail_url TEXT,
        tiktok_created_at TIMESTAMP,
        mirrored_to_instagram BOOLEAN DEFAULT false,
        instagram_post_id TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tiktok_accounts (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        access_token TEXT,
        open_id TEXT,
        connected_at TIMESTAMP DEFAULT NOW(),
        auto_mirror BOOLEAN DEFAULT true
      )
    `);

    if (method === 'GET') {
      const action = event.queryStringParameters?.action;

      if (action === 'posts') {
        const result = await pool.query('SELECT * FROM tiktok_posts ORDER BY created_at DESC LIMIT 100');
        return { statusCode: 200, headers, body: JSON.stringify({ posts: result.rows }) };
      }

      if (action === 'accounts') {
        const result = await pool.query('SELECT id, username, connected_at, auto_mirror FROM tiktok_accounts ORDER BY connected_at DESC');
        return { statusCode: 200, headers, body: JSON.stringify({ accounts: result.rows }) };
      }

      if (action === 'stats') {
        const total = await pool.query('SELECT COUNT(*) FROM tiktok_posts');
        const mirrored = await pool.query('SELECT COUNT(*) FROM tiktok_posts WHERE mirrored_to_instagram = true');
        const pending = await pool.query('SELECT COUNT(*) FROM tiktok_posts WHERE mirrored_to_instagram = false');
        return { statusCode: 200, headers, body: JSON.stringify({
          total: parseInt(total.rows[0].count),
          mirrored: parseInt(mirrored.rows[0].count),
          pending: parseInt(pending.rows[0].count),
        })};
      }

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { action } = body;

      if (action === 'connect') {
        // Save TikTok account connection
        const { username, accessToken, openId } = body;
        await pool.query(`
          INSERT INTO tiktok_accounts (username, access_token, open_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (username) DO UPDATE SET access_token = $2, open_id = $3, connected_at = NOW()
        `, [username, accessToken || '', openId || '']);
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: 'TikTok account connected' }) };
      }

      if (action === 'disconnect') {
        const { username } = body;
        await pool.query('DELETE FROM tiktok_accounts WHERE username = $1', [username]);
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }

      if (action === 'save-post') {
        // Save a TikTok post to be mirrored
        const { tiktokId, author, caption, videoUrl, thumbnailUrl, tiktokCreatedAt } = body;
        const existing = await pool.query('SELECT id FROM tiktok_posts WHERE tiktok_id = $1', [tiktokId]);
        if (existing.rows.length > 0) {
          return { statusCode: 200, headers, body: JSON.stringify({ ok: true, skipped: true, reason: 'already exists' }) };
        }
        await pool.query(`
          INSERT INTO tiktok_posts (tiktok_id, author, caption, video_url, thumbnail_url, tiktok_created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [tiktokId, author, caption, videoUrl, thumbnailUrl, tiktokCreatedAt || new Date()]);
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, saved: true }) };
      }

      if (action === 'mirror') {
        // Queue a TikTok post to Instagram
        const { postId } = body;
        const postRes = await pool.query('SELECT * FROM tiktok_posts WHERE id = $1', [postId]);
        if (!postRes.rows.length) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Post not found' }) };
        const post = postRes.rows[0];
        if (post.mirrored_to_instagram) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, skipped: 'already mirrored' }) };

        // Save to posts queue for Instagram
        const saved = await pool.query(`
          INSERT INTO posts (video_url, thumbnail_url, caption, status, media_type)
          VALUES ($1, $2, $3, 'pending', 'VIDEO')
          RETURNING id
        `, [post.video_url, post.thumbnail_url, post.caption || '']);

        await pool.query('UPDATE tiktok_posts SET mirrored_to_instagram = true WHERE id = $1', [postId]);
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, instagramQueueId: saved.rows[0].id }) };
      }

      if (action === 'mirror-all') {
        // Queue all unmirrored TikTok posts to Instagram
        const posts = await pool.query('SELECT * FROM tiktok_posts WHERE mirrored_to_instagram = false ORDER BY tiktok_created_at DESC');
        let queued = 0;
        for (const post of posts.rows) {
          const existing = await pool.query('SELECT id FROM posts WHERE video_url = $1', [post.video_url]);
          if (existing.rows.length === 0) {
            await pool.query(`
              INSERT INTO posts (video_url, thumbnail_url, caption, status, media_type)
              VALUES ($1, $2, $3, 'pending', 'VIDEO')
            `, [post.video_url, post.thumbnail_url, post.caption || '']);
            queued++;
          }
          await pool.query('UPDATE tiktok_posts SET mirrored_to_instagram = true WHERE id = $1', [post.id]);
        }
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, queued }) };
      }

      if (action === 'toggle-auto-mirror') {
        const { username, enabled } = body;
        await pool.query('UPDATE tiktok_accounts SET auto_mirror = $1 WHERE username = $2', [enabled, username]);
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }

      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('tiktok-api error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
