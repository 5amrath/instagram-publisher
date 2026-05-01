const { v2: cloudinary } = require('cloudinary');
const Busboy = require('busboy');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function parseMultipartWithBusboy(event) {
  return new Promise((resolve, reject) => {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    const busboy = Busboy({ headers: { 'content-type': contentType } });
    let fileData = null;
    let filename = 'upload';
    let mimeType = '';

    busboy.on('file', (fieldname, file, info) => {
      filename = info.filename || 'upload';
      mimeType = info.mimeType || '';
      const chunks = [];
      file.on('data', (chunk) => chunks.push(chunk));
      file.on('end', () => {
        fileData = Buffer.concat(chunks);
      });
    });

    busboy.on('finish', () => resolve({ fileData, filename, mimeType }));
    busboy.on('error', reject);

    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body, 'binary');
    busboy.write(body);
    busboy.end();
  });
}

function parseMultipartManual(body, boundary, isBase64) {
  const buf = isBase64 ? Buffer.from(body, 'base64') : Buffer.from(body, 'binary');
  const boundaryBuf = Buffer.from('--' + boundary);
  const parts = [];
  let start = 0;
  while (start < buf.length) {
    const boundaryIdx = buf.indexOf(boundaryBuf, start);
    if (boundaryIdx === -1) break;
    const headerStart = boundaryIdx + boundaryBuf.length;
    if (headerStart >= buf.length) break;
    let actualHeaderStart = headerStart;
    if (buf[actualHeaderStart] === 13 && buf[actualHeaderStart + 1] === 10) {
      actualHeaderStart += 2;
    }
    const CRLF2 = Buffer.from('\r\n\r\n');
    const headerEnd = buf.indexOf(CRLF2, actualHeaderStart);
    if (headerEnd === -1) break;
    const headers = buf.slice(actualHeaderStart, headerEnd).toString('utf8');
    const dataStart = headerEnd + 4;
    const nextBoundaryIdx = buf.indexOf(boundaryBuf, dataStart);
    if (nextBoundaryIdx === -1) break;
    const dataEnd = nextBoundaryIdx - 2;
    if (dataEnd > dataStart) {
      parts.push({ headers, data: buf.slice(dataStart, dataEnd) });
    }
    start = nextBoundaryIdx;
  }
  return parts;
}

function detectMediaType(filename, mimeType) {
  const ext = (filename || '').toLowerCase().split('.').pop();
  const videoExts = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'm4v'];
  if (videoExts.includes(ext)) return 'VIDEO';
  if ((mimeType || '').startsWith('video/')) return 'VIDEO';
  return 'IMAGE';
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    const boundaryMatch = contentType.match(/boundary=([^;\s]+)/);
    if (!boundaryMatch) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No multipart boundary found' }) };
    }

    let fileData = null;
    let filename = 'upload';
    let mimeType = '';

    try {
      const parsed = await parseMultipartWithBusboy(event);
      fileData = parsed.fileData;
      filename = parsed.filename || 'upload';
      mimeType = parsed.mimeType || '';
    } catch (busboyErr) {
      console.warn('Busboy failed, falling back to manual parser:', busboyErr.message);
      const boundary = boundaryMatch[1].trim();
      const parts = parseMultipartManual(event.body, boundary, event.isBase64Encoded);
      for (const part of parts) {
        const cdMatch = part.headers.match(/Content-Disposition:[^\r\n]*name="([^"]+)"/i);
        const ctMatch = part.headers.match(/Content-Type:\s*([^\r\n]+)/i);
        const fnMatch = part.headers.match(/filename="([^"]+)"/i);
        if (cdMatch) {
          fileData = part.data;
          if (fnMatch) filename = fnMatch[1];
          if (ctMatch) mimeType = ctMatch[1].trim();
          break;
        }
      }
    }

    if (!fileData || fileData.length === 0) {
      console.error('No file data found. Body length:', event.body ? event.body.length : 0, 'isBase64:', event.isBase64Encoded);
      return { statusCode: 400, body: JSON.stringify({ error: 'No file found in upload' }) };
    }

    console.log('Uploading file:', filename, 'size:', fileData.length, 'type:', mimeType);

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
      thumbnailUrl = cloudinary.url(uploadResult.public_id, {
        resource_type: 'video',
        transformation: [{ fetch_format: 'jpg', quality: 'auto', start_offset: '0' }],
        secure: true,
      });
    }

    console.log('Upload success:', uploadResult.secure_url);

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
