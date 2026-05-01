const axios = require('axios');

const IG_BASE = 'https://graph.facebook.com/v21.0';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForContainer(creationId, token, maxAttempts = 8) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await axios.get(`${IG_BASE}/${creationId}`, {
      params: { fields: 'status,status_code', access_token: token },
      timeout: 8000,
    });
    const { status_code } = res.data;
    if (status_code === 'FINISHED') return true;
    if (status_code === 'ERROR') throw new Error('Instagram media processing failed');
    if (status_code === 'EXPIRED') throw new Error('Media container expired');
    // IN_PROGRESS or PUBLISHED - wait 3s and retry
    await sleep(3000);
  }
  // After 8 attempts (24s), try publishing anyway - Instagram often works even without FINISHED
  return true;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const igUserId = process.env.INSTAGRAM_USER_ID;

  if (!token || !igUserId) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing Instagram credentials' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { mediaUrl, videoUrl, mediaType, caption = '' } = body;
  const isVideo = mediaType === 'VIDEO' || mediaType === 'REELS' || videoUrl;
  const mediaSource = videoUrl || mediaUrl;

  if (!mediaSource) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing media URL' }) };
  }

  try {
    // Step 1: Create media container
    const containerParams = {
      caption,
      access_token: token,
    };

    if (isVideo) {
      containerParams.video_url = mediaSource;
      containerParams.media_type = 'REELS';
    } else {
      containerParams.image_url = mediaSource;
    }

    const containerRes = await axios.post(
      `${IG_BASE}/${igUserId}/media`,
      containerParams,
      { timeout: 15000 }
    );

    const creationId = containerRes.data.id;
    if (!creationId) throw new Error('No creation ID returned from Instagram');

    // Step 2: For videos, wait for processing (up to 24s with 8 polls x 3s)
    if (isVideo) {
      await waitForContainer(creationId, token);
    }

    // Step 3: Publish
    const publishRes = await axios.post(
      `${IG_BASE}/${igUserId}/media_publish`,
      { creation_id: creationId, access_token: token },
      { timeout: 10000 }
    );

    const igPostId = publishRes.data.id;
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, igPostId }),
    };
  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message || 'Unknown error';
    console.error('Publish error:', errMsg, err.response?.data);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: errMsg }),
    };
  }
};
