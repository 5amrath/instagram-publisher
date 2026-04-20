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

    // Lock next pending post atomically
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
      console.log('[auto-post] No pending posts');
      return { statusCode: 200, body: JSON.stringify({ message: 'No pending posts' }) };
    }

    post = lockResult.rows[0];
    console.log(`[auto-post] Processing post ${post.id}, type: ${post.media_type || 'VIDEO'}`);

    let caption = post.caption;

    // If no caption, analyze the first frame of the video for a viral caption
    if (!caption || caption.trim() === '') {
      if (post.thumbnail_url) {
        console.log('[auto-post] Analyzing first frame for caption...');
        caption = await analyzeFrame(post.thumbnail_url);
        console.log('[auto-post] AI caption:', caption.substring(0, 60) + '...');
      } else {
        caption = generateFallbackCaption();
      }
    }

    // Determine if video (Reels) or image
    const isVideo = post.media_type === 'VIDEO' || post.media_type === 'REELS';

    // Create Instagram media container
    const containerParams = new URLSearchParams({ access_token: token, caption });

    if (isVideo) {
      containerParams.set('media_type', 'REELS');
      containerParams.set('video_url', post.media_url);
    } else {
      containerParams.set('image_url', post.media_url);
    }

    const containerRes = await igRequest(`/${userId}/media?${containerParams}`, 'POST');
    const containerId = containerRes.id;
    if (!containerId) throw new Error('No container ID returned from Instagram');

    // Wait for processing
    await waitForContainer(containerId, token, isVideo ? 60 : 15);

    // Publish
    const publishRes = await igRequest(
      `/${userId}/media_publish?creation_id=${containerId}&access_token=${token}`,
      'POST'
    );

    // Update DB
    await query(
      `UPDATE posts SET status = 'posted', posted_at = NOW(), caption = $2, ig_post_id = $3 WHERE id = $1`,
      [post.id, caption, publishRes.id || null]
    );

    console.log(`[auto-post] Published ${post.id} -> IG ${publishRes.id}`);
    return { statusCode: 200, body: JSON.stringify({ message: 'Posted', postId: post.id }) };

  } catch (err) {
    console.error('[auto-post] Error:', err.message);

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
        console.error('[auto-post] DB update failed:', dbErr.message);
      }
    }

    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

/**
 * Analyze video thumbnail with GPT-4o-mini vision for a viral Reels caption
 */
async function analyzeFrame(imageUrl) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return generateFallbackCaption();

  try {
    const payload = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You write Instagram Reels captions for @ascend.deals â a male self-improvement and affiliate deals account focused on looksmaxxing, skincare, grooming, and lifestyle products.

RULES:
- First line MUST be a short punchy hook (under 10 words). This is what people see before "...more"
- Hook styles: "This is why you're not ___", "Stop doing ___ wrong", "The ___ nobody talks about", "You need this if ___", "POV: you finally ___", "This changed everything"
- After the hook: 1-2 short lines of value or intrigue
- End with "Link in bio" or "Check bio"
- Then 6-8 hashtags on a new line
- NO emojis. NO exclamation marks. Lowercase energy
- Sound like a real person not a brand
- Total caption under 120 words
- Always include #ascenddeals in hashtags
- Mix broad (#fyp #viral) with niche (#looksmax #skincare #mog)`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Look at this video frame. Identify what the product or topic is. Write a Reels caption with a scroll-stopping hook.' },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
          ],
        },
      ],
      max_tokens: 250,
      temperature: 0.9,
    });

    const result = await callOpenAI(apiKey, payload);

    if (result.choices?.[0]?.message?.content) {
      return result.choices[0].message.content.trim();
    }
    return generateFallbackCaption();
  } catch (err) {
    console.error('[auto-post] Frame analysis failed:', err.message);
    return generateFallbackCaption();
  }
}

function generateFallbackCaption() {
  const hooks = [
    "this is why you look the same every month",
    "stop skipping this in your routine",
    "the one product that actually changed my skin",
    "nobody talks about this but it works",
    "you need this if you're serious about your glow up",
    "POV: you finally found what works",
    "this is the difference between trying and results",
    "your routine is missing this one thing",
    "the product everyone is sleeping on right now",
    "this is what separates average from elite",
  ];

  const bodies = [
    "most people overlook this. don't be most people.",
    "the results speak for themselves.",
    "once you try it you won't go back.",
    "every detail matters when you're leveling up.",
    "this is what consistency looks like.",
  ];

  const tagSets = [
    "#looksmax #skincare #glowup #mog #ascenddeals #fyp #viral #selfcare",
    "#looksmax #grooming #selfimprovement #mog #ascenddeals #fyp #trending #skincare",
    "#skincare #looksmaxxing #deals #glowup #ascenddeals #fyp #viral #routine",
  ];

  const hook = hooks[Math.floor(Math.random() * hooks.length)];
  const body = bodies[Math.floor(Math.random() * bodies.length)];
  const tags = tagSets[Math.floor(Math.random() * tagSets.length)];
  return `${hook}\n\n${body}\n\nlink in bio\n\n${tags}`;
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
    req.setTimeout(25000, () => { req.destroy(); reject(new Error('OpenAI timeout')); });
    req.write(payload);
    req.end();
  });
}

async function igRequest(path, method = 'GET') {
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
          if (p.error) reject(new Error(p.error.message));
          else resolve(p);
        } catch { reject(new Error('Invalid IG response')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('IG timeout')); });
    req.end();
  });
}

async function waitForContainer(id, token, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const s = await igRequest(`/${id}?fields=status_code&access_token=${token}`);
    if (s.status_code === 'FINISHED') return;
    if (s.status_code === 'ERROR') throw new Error('Instagram media processing failed');
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('Video processing timed out. Try a shorter or smaller video.');
}
