const { query } = require('./utils/db');
const https = require('https');

const IG_BASE = 'graph.facebook.com';
const IG_VERSION = 'v21.0';

exports.handler = async (event) => {
  console.log('[auto-post] Worker triggered at', new Date().toISOString());

  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;

  if (!token || !userId) {
    console.error('[auto-post] Missing Instagram credentials');
    return { statusCode: 500, body: 'Missing Instagram credentials' };
  }

  let post = null;

  try {
    // Check daily limit
    const settingsResult = await query(`SELECT value FROM settings WHERE key = 'daily_limit'`);
    const dailyLimit = settingsResult.rows[0] ? parseInt(settingsResult.rows[0].value, 10) : 25;

    const todayResult = await query(`SELECT COUNT(*) AS count FROM posts WHERE posted_at >= CURRENT_DATE`);
    const postedToday = parseInt(todayResult.rows[0].count, 10);

    if (postedToday >= dailyLimit) {
      console.log(`[auto-post] Daily limit reached (${postedToday}/${dailyLimit})`);
      return { statusCode: 200, body: JSON.stringify({ message: 'Daily limit reached' }) };
    }

    // Lock next pending post atomically (also pick up stuck scheduled posts older than 10 min)
    const lockResult = await query(`
      UPDATE posts SET status = 'scheduled', error_message = NULL
      WHERE id = (
        SELECT id FROM posts
        WHERE status = 'pending'
           OR (status = 'scheduled' AND created_at < NOW() - INTERVAL '10 minutes')
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `);

    if (lockResult.rowCount === 0) {
      console.log('[auto-post] No pending posts');
      return { statusCode: 200, body: JSON.stringify({ message: 'No pending posts' }) };
    }

    post = lockResult.rows[0];
    console.log(`[auto-post] Processing post ${post.id}, type: ${post.media_type || 'VIDEO'}`);

    let caption = post.caption;

    // Generate caption from first frame if blank
    if (!caption || caption.trim() === '') {
      if (post.thumbnail_url) {
        console.log('[auto-post] Analyzing first frame for caption...');
        caption = await analyzeFrame(post.thumbnail_url);
      } else {
        caption = generateFallbackCaption();
      }
    }

    const isVideo = post.media_type === 'VIDEO' || post.media_type === 'REELS' || !post.media_type;
    const mediaUrl = post.video_url || post.media_url;

    // Build container params
    const containerParams = new URLSearchParams({ access_token: token, caption });
    if (isVideo) {
      containerParams.set('media_type', 'REELS');
      containerParams.set('video_url', mediaUrl);
    } else {
      containerParams.set('image_url', mediaUrl);
    }

    // Step 1: Create media container
    console.log('[auto-post] Creating media container...');
    const containerRes = await igRequest(`/${userId}/media?${containerParams}`, 'POST');
    const containerId = containerRes.id;
    if (!containerId) throw new Error('No container ID returned');

    // Step 2: For videos, poll status (max 20s to fit within 26s limit)
    if (isVideo) {
      console.log('[auto-post] Waiting for container to process...');
      let ready = false;
      for (let i = 0; i < 6; i++) {
        await sleep(3000);
        try {
          const s = await igRequest(`/${containerId}?fields=status_code&access_token=${token}`);
          console.log(`[auto-post] Container status: ${s.status_code}`);
          if (s.status_code === 'FINISHED' || s.status_code === 'PUBLISHED') { ready = true; break; }
          if (s.status_code === 'ERROR') throw new Error('Instagram media processing failed');
        } catch (e) {
          if (e.message.includes('processing failed')) throw e;
          // Ignore transient errors and retry
        }
      }
      // Attempt publish even if not FINISHED (Instagram usually accepts it)
      console.log(`[auto-post] Container ready: ${ready}. Attempting publish...`);
    }

    // Step 3: Publish
    const publishRes = await igRequest(
      `/${userId}/media_publish?creation_id=${containerId}&access_token=${token}`,
      'POST'
    );

    // Step 4: Update DB
    await query(
      `UPDATE posts SET status = 'posted', posted_at = NOW(), caption = $2, ig_post_id = $3 WHERE id = $1`,
      [post.id, caption, publishRes.id || null]
    );

    console.log(`[auto-post] Successfully posted ${post.id} -> IG ${publishRes.id}`);
    return { statusCode: 200, body: JSON.stringify({ message: 'Posted', postId: post.id, igId: publishRes.id }) };

  } catch (err) {
    console.error('[auto-post] Error:', err.message);

    if (post && post.id) {
      try {
        const retryResult = await query(`SELECT retry_count FROM posts WHERE id = $1`, [post.id]);
        const currentRetries = retryResult.rows[0]?.retry_count || 0;
        const newStatus = currentRetries >= 3 ? 'failed' : 'pending';
        await query(
          `UPDATE posts SET retry_count = retry_count + 1, error_message = $2, status = $3 WHERE id = $1`,
          [post.id, err.message.substring(0, 500), newStatus]
        );
        console.log(`[auto-post] Post ${post.id} set to ${newStatus} (retry ${currentRetries + 1})`);
      } catch (dbErr) {
        console.error('[auto-post] DB update failed:', dbErr.message);
      }
    }

    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function analyzeFrame(imageUrl) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return generateFallbackCaption();

  try {
    const payload = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You write Instagram Reels captions for @ascend.deals - a male self-improvement and deals account focused on looksmaxxing, skincare, grooming, and lifestyle products.

RULES:
- First line: short punchy hook under 10 words. Examples: "this is why you look the same", "stop skipping this", "the product nobody talks about", "POV: you finally found what works"
- 1-2 lines of value/intrigue after
- End with "link in bio"
- Then 6-8 hashtags: mix #fyp #viral with niche tags
- NO emojis. NO exclamation marks. Lowercase only
- Sound like a real person, not a brand
- Always include #ascenddeals`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Identify the product or topic in this frame. Write a viral Reels caption with a scroll-stopping hook.' },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0.85,
    });

    const result = await callOpenAI(apiKey, payload);
    return result.choices?.[0]?.message?.content?.trim() || generateFallbackCaption();
  } catch (err) {
    console.error('[auto-post] Frame analysis failed:', err.message);
    return generateFallbackCaption();
  }
}

function generateFallbackCaption() {
  const hooks = [
    "this is why you look the same every month",
    "stop skipping this in your routine",
    "the one product that actually changed everything",
    "nobody talks about this but it works",
    "POV: you finally found what works",
    "your routine is missing this one thing",
    "the product everyone is sleeping on",
    "this is what separates average from results",
  ];
  const bodies = [
    "most people overlook this. don't be most people.",
    "the results speak for themselves.",
    "once you try it you won't go back.",
    "every detail matters when you're leveling up.",
  ];
  const tagSets = [
    "#looksmax #skincare #glowup #mog #ascenddeals #fyp #viral #selfcare",
    "#looksmaxxing #grooming #selfimprovement #mog #ascenddeals #fyp #trending #skincare",
    "#skincare #deals #glowup #ascenddeals #fyp #viral #routine #mog",
  ];
  const h = hooks[Math.floor(Math.random() * hooks.length)];
  const b = bodies[Math.floor(Math.random() * bodies.length)];
  const t = tagSets[Math.floor(Math.random() * tagSets.length)];
  return `${h}\n\n${b}\n\nlink in bio\n\n${t}`;
}

function callOpenAI(apiKey, payload) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Bad OpenAI response')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('OpenAI timeout')); });
    req.write(payload);
    req.end();
  });
}

function igRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: IG_BASE,
      path: `/${IG_VERSION}${path}`,
      method,
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const p = JSON.parse(data);
          if (p.error) reject(new Error(p.error.message || JSON.stringify(p.error)));
          else resolve(p);
        } catch { reject(new Error('Invalid IG response: ' + data.substring(0, 100))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('IG request timeout')); });
    req.end();
  });
}
