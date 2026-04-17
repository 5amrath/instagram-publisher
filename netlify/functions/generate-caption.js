const { generateCaption } = require('./utils/ai');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    // use defaults
  }

  try {
    const caption = await generateCaption(body.context || '');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption }),
    };
  } catch (err) {
    console.error('generate-caption error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
