const axios = require('axios');
const { pool } = require('./utils/db');

const IG_BASE = 'https://graph.facebook.com/v21.0';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Poll container status - used only for immediate publish flow
async function waitForContainer(creationId, token, maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await axios.get(`${IG_BASE}/${creationId}`, {
        params: { fields: 'status,status_code', access_token: token },
        timeout: 5000,
      });
      const { status_code } = res.data;
      if (status_code === 'FINISHED') return true;
      if (status_code === 'ERROR') throw new Error('Instagram media processing failed');
      if (status_code === 'EXPIRED') throw new Error('Media container expired');
      await sleep(2000);
    } catch (e) {
      if (e.message.includes('processing failed') || e.message.includes('expired')) throw e;
      // network error - just retry
      await sleep(2000);
    }
  }
  // Return true and attempt publish anyway - Instagram often succeeds
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

  const { mediaUrl, videoUrl, mediaType, caption = '', postId, queueMode } = body;
  const isVideo = mediaType === 'VIDEO' || mediaType === 'REELS' || videoUrl;
  const mediaSource = videoUrl || mediaUrl;

  if (!mediaSource) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing media URL' }) };
  }

  // QUEUE MODE: Just save to DB, auto-post.js will handle the actual posting
  // This avoids the 26s Netlify timeout entirely for video Reels
  if (queueMode && postId) {
    try {
      await pool.query(
        'UPDATE posts SET status = $1, updated_at = NOW() WHERE id = $2',
        ['pending', postId]
      );
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, queued: true, message: 'Added to queue - will post automatically' }),
      };
    } catch (dbErr) {
      console.error('DB queue error:', dbErr.message);
      // Fall through to direct publish
    }
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
      { timeout: 12000 }
    );

    const creationId = containerRes.data.id;
    if (!creationId) throw new Error('No creation ID returned from Instagram');

    // Step 2: For videos, poll but with reduced attempts to stay under timeout
    if (isVideo) {
      await waitForContainer(creationId, token);
    }

    // Step 3: Publish
    const publishRes = await axios.post(
      `${IG_BASE}/${igUserId}/media_publish`,
      { creation_id: creationId, access_token: token },
      { timeout: 8000 }
    );

    const igPostId = publishRes.data.id;

    // Update DB if postId provided
    if (postId) {
      try {
        await pool.query(
          'UPDATE posts SET status = $1, ig_post_id = $2, posted_at = NOW(), updated_at = NOW() WHERE id = $3',
          ['posted', igPostId, postId]
        );
      } catch (dbErr) {
        console.error('DB update error (non-fatal):', dbErr.message);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, igPostId }),
    };
  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message || 'Unknown error';
    console.error('Publish error:', errMsg, err.response?.data);

    // Update DB to failed if postId provided
    if (postId) {
      try {
        await pool.query(
          'UPDATE posts SET status = $1, updated_at = NOW() WHERE id = $2',
          ['failed', postId]
        );
      } catch (dbErr) {}
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: errMsg }),
    };
  }
};
