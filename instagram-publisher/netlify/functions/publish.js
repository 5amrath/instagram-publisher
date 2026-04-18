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
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Instagram API timeout')); });
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
      body: JSON.stringify({ error: 'INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID must be set' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { mediaUrl, videoUrl, mediaType = 'IMAGE', caption = '' } = body;
  const url = videoUrl || mediaUrl;

  if (!url) {
    return { statusCode: 400, body: JSON.stringify({ error: 'mediaUrl or videoUrl is required' }) };
  }

  try {
    const isVideo = mediaType === 'VIDEO' || mediaType === 'REELS';
    const containerParams = new URLSearchParams({ access_token: token, caption });

    if (isVideo) {
      containerParams.set('media_type', 'REELS');
      containerParams.set('video_url', url);
    } else {
      containerParams.set('image_url', url);
    }

    const containerRes = await igRequest(`/${userId}/media?${containerParams}`, 'POST');
    const containerId = containerRes.id;
    if (!containerId) throw new Error('No container ID returned from Instagram');

    if (isVideo) {
      await waitForContainer(containerId, token, 30);
    } else {
      await waitForContainer(containerId, token, 10);
    }

    const publishRes = await igRequest(
      `/${userId}/media_publish?creation_id=${containerId}&access_token=${token}`,
      'POST'
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: publishRes.id,
        status: 'published',
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

async function waitForContainer(containerId, token, maxAttempts = 15) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await igRequest(
      `/${containerId}?fields=status_code&access_token=${token}`
    );
    if (status.status_code === 'FINISHED') return;
    if (status.status_code === 'ERROR') throw new Error('Instagram media processing failed');
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('Media container timed out during processing');
}
