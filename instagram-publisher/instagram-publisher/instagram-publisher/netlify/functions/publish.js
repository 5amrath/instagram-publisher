// Netlify Function: publish
// Creates an Instagram media container then publishes it (or schedules it).
// Instagram Graph API flow:
//   1. POST /{user-id}/media  → returns container id
//   2. POST /{user-id}/media_publish  → publishes (if not scheduled)
//
// Note: Scheduled publishing requires a Creator/Business account with
// content publishing permissions and is only available via the API
// for accounts using the Content Publishing API (approved apps).
// For scheduling, we store the job locally and use a Netlify scheduled
// function to publish at the right time.

const https = require('https');

const IG_BASE = 'graph.facebook.com';
const IG_VERSION = 'v21.0';

async function igRequest(path, method = 'GET', body = null) {
  const postData = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: IG_BASE,
      path: `/${IG_VERSION}${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
      },
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
    if (postData) req.write(postData);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;

  if (!token || !userId) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID must be set in Netlify environment variables.',
      }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { mediaUrl, mediaType = 'IMAGE', caption = '', scheduleTime } = body;

  if (!mediaUrl) {
    return { statusCode: 400, body: JSON.stringify({ error: 'mediaUrl is required' }) };
  }

  try {
    // Step 1 — Create media container
    const containerParams = {
      caption,
      access_token: token,
    };

    if (mediaType === 'VIDEO') {
      containerParams.media_type = 'REELS';
      containerParams.video_url = mediaUrl;
    } else {
      containerParams.image_url = mediaUrl;
    }

    // If scheduling, add publish_time (Unix timestamp, must be 10 min–75 days in future)
    if (scheduleTime) {
      const ts = Math.floor(new Date(scheduleTime).getTime() / 1000);
      containerParams.scheduled_publish_time = ts;
      containerParams.media_type = mediaType === 'VIDEO' ? 'REELS' : 'IMAGE';
    }

    const containerRes = await igRequest(
      `/${userId}/media?${new URLSearchParams(containerParams)}`,
      'POST'
    );

    const containerId = containerRes.id;
    if (!containerId) throw new Error('No container ID returned from Instagram');

    // Step 2 — Wait for container to be ready (for videos this can take a moment)
    if (mediaType === 'VIDEO') {
      await waitForContainer(containerId, token);
    }

    // Step 3 — Publish (or leave for scheduled publish)
    let publishedId = containerId;
    if (!scheduleTime) {
      const publishRes = await igRequest(
        `/${userId}/media_publish?creation_id=${containerId}&access_token=${token}`,
        'POST'
      );
      publishedId = publishRes.id;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: publishedId,
        status: scheduleTime ? 'scheduled' : 'published',
        scheduleTime: scheduleTime || null,
      }),
    };
  } catch (err) {
    console.error('publish error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

// Poll container status until FINISHED (for videos)
async function waitForContainer(containerId, token, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await igRequest(
      `/${containerId}?fields=status_code&access_token=${token}`
    );
    if (status.status_code === 'FINISHED') return;
    if (status.status_code === 'ERROR') throw new Error('Instagram media container processing failed');
    // Wait 3 seconds between polls
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Video container timed out during processing');
}
