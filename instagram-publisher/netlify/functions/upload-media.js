const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'm4v', '3gp'];
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Cloudinary not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET to env.' }) };
  }

  try {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';

    if (!contentType.includes('multipart')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Expected multipart/form-data' }) };
    }

    const boundary = getBoundary(contentType);
    if (!boundary) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No boundary found in content-type' }) };
    }

    // Decode body -- Netlify base64-encodes binary uploads
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body, 'binary');

    const file = extractFile(rawBody, boundary);

    if (!file || !file.data || file.data.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No file found in upload. Make sure the form field is named "image" or "file".' }) };
    }

    console.log(`[upload] File: ${file.filename || 'unknown'}, size: ${file.data.length}, mime: ${file.contentType || 'unknown'}`);

    // Detect if video
    const ext = file.filename ? file.filename.toLowerCase().split('.').pop() : '';
    const isVideo = VIDEO_MIMES.includes(file.contentType) || VIDEO_EXTS.includes(ext);

    // Upload to Cloudinary using resource_type auto so it figures out the format
    const uploadResult = await new Promise((resolve, reject) => {
      const opts = {
        resource_type: 'auto',
        folder: 'instagram-publisher',
        timeout: 300000,
      };

      // If we know the filename, pass it so Cloudinary can detect format
      if (file.filename) {
        opts.public_id = file.filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + Date.now();
      }

      const stream = cloudinary.uploader.upload_stream(opts, (error, result) => {
        if (error) {
          console.error('[upload] Cloudinary error:', error.message);
          reject(error);
        } else {
          resolve(result);
        }
      });

      stream.end(file.data);
    });

    const mediaUrl = uploadResult.secure_url;
    const detectedVideo = uploadResult.resource_type === 'video' || isVideo;

    let thumbnailUrl = null;
    if (detectedVideo) {
      // Get first frame as JPG thumbnail
      thumbnailUrl = mediaUrl
        .replace('/video/upload/', '/video/upload/so_0,w_640,h_640,c_fill,f_jpg/')
        .replace(/\.[^.]+$/, '.jpg');
    } else {
      thumbnailUrl = mediaUrl;
    }

    console.log(`[upload] Success: type=${detectedVideo ? 'VIDEO' : 'IMAGE'}, url=${mediaUrl.substring(0, 80)}...`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: mediaUrl,
        videoUrl: detectedVideo ? mediaUrl : null,
        thumbnailUrl,
        mediaType: detectedVideo ? 'VIDEO' : 'IMAGE',
      }),
    };
  } catch (err) {
    console.error('[upload] Error:', err.message, err.http_code || '');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Upload failed: ${err.message}` }),
    };
  }
};

/**
 * Extract boundary string from content-type header.
 */
function getBoundary(contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/i);
  return match ? (match[1] || match[2]) : null;
}

/**
 * Parse multipart form data and extract the first file.
 * This handles binary data properly without corruption.
 */
function extractFile(buffer, boundary) {
  const boundaryBuf = Buffer.from('--' + boundary);
  const crlfcrlf = Buffer.from('\r\n\r\n');
  const crlf = Buffer.from('\r\n');

  let pos = bufferIndexOf(buffer, boundaryBuf, 0);
  if (pos === -1) return null;

  while (pos !== -1) {
    // Move past boundary + CRLF
    const partStart = pos + boundaryBuf.length;

    // Check for closing boundary (--)
    if (buffer.length > partStart + 1 && buffer[partStart] === 0x2D && buffer[partStart + 1] === 0x2D) {
      break;
    }

    // Find next boundary
    const nextBoundary = bufferIndexOf(buffer, boundaryBuf, partStart);
    if (nextBoundary === -1) break;

    // Extract this part (between current boundary and next)
    const partBuf = buffer.slice(partStart, nextBoundary);

    // Split headers from body at \r\n\r\n
    const headerEnd = bufferIndexOf(partBuf, crlfcrlf, 0);
    if (headerEnd === -1) { pos = nextBoundary; continue; }

    const headerStr = partBuf.slice(0, headerEnd).toString('utf-8');

    // Body starts after \r\n\r\n, ends before trailing \r\n
    let bodyStart = headerEnd + 4;
    // Skip leading \r\n after boundary line
    if (partBuf[0] === 0x0D && partBuf[1] === 0x0A) {
      // Headers start after CRLF following boundary
    }

    let body = partBuf.slice(bodyStart);

    // Remove trailing \r\n before next boundary
    if (body.length >= 2 && body[body.length - 2] === 0x0D && body[body.length - 1] === 0x0A) {
      body = body.slice(0, body.length - 2);
    }

    // Check if this part is a file upload
    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    const ctMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);

    if (nameMatch && (nameMatch[1] === 'image' || nameMatch[1] === 'file' || filenameMatch)) {
      return {
        name: nameMatch[1],
        filename: filenameMatch ? filenameMatch[1] : null,
        contentType: ctMatch ? ctMatch[1].trim() : null,
        data: body,
      };
    }

    pos = nextBoundary;
  }

  return null;
}

/**
 * Find buffer B inside buffer A starting from position.
 */
function bufferIndexOf(buf, search, from) {
  const len = buf.length;
  const sLen = search.length;
  for (let i = from; i <= len - sLen; i++) {
    let match = true;
    for (let j = 0; j < sLen; j++) {
      if (buf[i + j] !== search[j]) { match = false; break; }
    }
    if (match) return i;
  }
  return -1;
}
