// Netlify Function: upload-media
// Receives a multipart image/video upload, hosts it on imgbb (free),
// returns the public URL that Instagram's API requires.

const https = require('https');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const imgbbKey = process.env.IMGBB_API_KEY;
  if (!imgbbKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'IMGBB_API_KEY not configured in Netlify env vars' }),
    };
  }

  try {
    // event.body is base64-encoded when isBase64Encoded is true (multipart)
    // We forward the raw body to imgbb's API
    const contentType = event.headers['content-type'] || '';

    // Parse the base64 image from multipart form data
    let base64Image = '';
    if (event.isBase64Encoded) {
      // Extract base64 from multipart — look for image data
      const boundary = contentType.split('boundary=')[1];
      if (boundary) {
        const rawBody = Buffer.from(event.body, 'base64').toString('binary');
        const parts = rawBody.split(`--${boundary}`);
        for (const part of parts) {
          if (part.includes('Content-Disposition') && part.includes('name="image"')) {
            const dataPart = part.split('\r\n\r\n')[1];
            if (dataPart) {
              const cleanData = dataPart.replace(/\r\n--$/, '').replace(/\r\n$/, '');
              base64Image = Buffer.from(cleanData, 'binary').toString('base64');
              break;
            }
          }
        }
      }
    }

    if (!base64Image) {
      // Fallback: treat whole body as base64 image
      base64Image = event.isBase64Encoded ? event.body : Buffer.from(event.body).toString('base64');
    }

    // Upload to imgbb
    const postData = new URLSearchParams({
      key: imgbbKey,
      image: base64Image,
      expiration: '600', // 10 min expiration is fine — Instagram fetches immediately
    }).toString();

    const result = await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.imgbb.com',
          path: '/1/upload',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch (e) { reject(new Error('Invalid imgbb response')); }
          });
        }
      );
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    if (!result.success) {
      throw new Error(result.error?.message || 'imgbb upload failed');
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: result.data.url }),
    };
  } catch (err) {
    console.error('upload-media error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
