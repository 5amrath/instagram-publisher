const { query } = require('./utils/db');

// POST /api/reset-scheduled
// Resets all scheduled (not-yet-posted) posts back to pending, clearing scheduled_at
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };
  try {
    const result = await query(
      "UPDATE posts SET status = 'pending', scheduled_at = NULL, container_id = NULL, error_message = NULL WHERE status = 'scheduled'"
    );
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: `Reset ${result.rowCount} scheduled posts to pending`, count: result.rowCount }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
