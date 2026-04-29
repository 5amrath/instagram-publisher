const axios = require('axios');

const IG_BASE = 'https://graph.facebook.com/v21.0';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForContainer(igUserId, creationId, token, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await axios.get(`${IG_BASE}/${creationId}`, {
      params: { fields: 'status,status_code', access_token: token },
    });
    const { status_code } = res.data;
    if (status_code === 'FINISHED') return true;
    if (status_code === 'ERROR') throw new Error('Instagram media processing failed');
    await sleep(3000);
  }
  throw new Error('Media container timed out after 90s');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { mediaUrl, videoUrl, mediaType, caption } = JSON.parse(event.body || '{}');
    const igUserId = process.env.INSTAGRAM_USER_ID;
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;

    if (!igUserId || !token) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing Instagram credentials' }) };
    }

    const isVideo = mediaType === 'VIDEO' || mediaType === 'REELS';
    const mediaEndpoint = `${IG_BASE}/${igUserId}/media`;

    let containerParams;
    if (isVideo) {
      const url = videoUrl || mediaUrl;
      if (!url) return { statusCode: 400, body: JSON.stringify({ error: 'videoUrl required for video posts' }) };
      containerParams = {
        video_url: url,
        media_type: 'REELS',
        caption: caption || '',
        access_token: token,
      };
    } else {
      const url = mediaUrl;
      if (!url) return { statusCode: 400, body: JSON.stringify({ error: 'mediaUrl required for image posts' }) };
      containerParams = {
        image_url: url,
        caption: caption || '',
        access_token: token,
      };
    }

    // Step 1: Create media container
    const containerRes = await axios.post(mediaEndpoint, containerParams);
    const creationId = containerRes.data.id;
    if (!creationId) throw new Error('No creation_id from Instagram');

    // Step 2: Wait for container to be ready (Reels need processing time)
    if (isVideo) {
      await waitForContainer(igUserId, creationId, token);
    }

    // Step 3: Publish
    const publishRes = await axios.post(`${IG_BASE}/${igUserId}/media_publish`, {
      creation_id: creationId,
      access_token: token,
    });

    const igPostId = publishRes.data.id;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, igPostId, creationId }),
    };
  } catch (err) {
    console.error('Publish error:', err.response?.data || err.message);
    const igError = err.response?.data?.error;
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: igError?.message || err.message || 'Publish failed',
        code: igError?.code,
        type: igError?.type,
      }),
    };
  }
};
