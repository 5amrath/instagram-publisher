const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function parseMultipart(body, boundary, isBase64) {
  const buf = isBase64 ? Buffer.from(body, 'base64') : Buffer.from(body, 'binary');
  const boundaryBuf = Buffer.from('--' + boundary);
  const parts = [];
  let start = 0;

  while (start < buf.length) {
    const boundaryIdx = buf.indexOf(boundaryBuf, start);
    if (boundaryIdx === -1) break;
    const headerStart = boundaryIdx + boundaryBuf.length;
    const CRLF2 = Buffer.from('\r\n\r\n');
    const headerEnd = buf.indexOf(CRLF2, headerStart);
    if (headerEnd === -1) break;
    const headers = buf.slice(headerStart, headerEnd).toString();
    const dataStart = headerEnd + 4;
    const nextBoundaryIdx = buf.indexOf(boundaryBuf, dataStart);
    if (nextBoundaryIdx === -1) break;
    const dataEnd = nextBoundaryIdx - 2; // trim trailing CRLF
    parts.push({ headers, data: buf.slice(dataStart, dataEnd) });
    start = nextBoundaryIdx;
  }
  return parts;
}

function detectMediaType(filename, mimeType) {
  const ext = (filename || '').toLowerCase().split('.').pop();
  const videoExts = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'm4v'];
  const videoMimes = ['video/'];
  if (videoExts.includes(ext)) return 'VIDEO';
  if (videoMimes.some((m) => (mimeType || '').startsWith(m))) return 'VIDEO';
  return 'IMAGE';
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    const boundaryMatch = contentType.match(/boundary=([^;]+)/);
    if (!boundaryMatch) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No multipart boundary found' }) };
    }
    const boundary = boundaryMatch[1].trim();
    const parts = parseMultipart(event.body, boundary, event.isBase64Encoded);

    let fileData = null;
    let filename = 'upload';
    let mimeType = '';

    for (const part of parts) {
      const cdMatch = part.headers.match(/Content-Disposition:[^\r\n]*name="([^"]+)"/i);
      const ctMatch = part.headers.match(/Content-Type:\s*([^\r\n]+)/i);
      const fnMatch = part.headers.match(/filename="([^"]+)"/i);
      if (cdMatch && (cdMatch[1] === 'image' || cdMatch[1] === 'file' || cdMatch[1] === 'video')) {
        fileData = part.data;
        if (fnMatch) filename = fnMatch[1];
        if (ctMatch) mimeType = ctMatch[1].trim();
        break;
      }
    }

    if (!fileData) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No file found in upload' }) };
    }

    const mediaType = detectMediaType(filename, mimeType);
    const resourceType = mediaType === 'VIDEO' ? 'video' : 'image';

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: resourceType,
          folder: 'instagram-publisher',
          public_id: `post_${Date.now()}`,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(fileData);
    });

    const videoUrl = mediaType === 'VIDEO' ? uploadResult.secure_url : null;
    let thumbnailUrl = null;

    if (mediaType === 'VIDEO') {
      // Generate thumbnail from first frame using Cloudinary transformation
      thumbnailUrl = cloudinary.url(uploadResult.public_id, {
        resource_type: 'video',
        transformation: [{ fetch_format: 'jpg', quality: 'auto', start_offset: '0' }],
        secure: true,
      });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: uploadResult.secure_url,
        videoUrl,
        thumbnailUrl,
        publicId: uploadResult.public_id,
        mediaType,
        format: uploadResult.format,
        width: uploadResult.width,
        height: uploadResult.height,
      }),
    };
  } catch (err) {
    console.error('Upload error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Upload failed' }),
    };
  }
};
