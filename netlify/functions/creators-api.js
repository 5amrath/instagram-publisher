const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

exports.handler = async (event) => {
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const method = event.httpMethod;
  const params = event.queryStringParameters || {};
  const body = JSON.parse(event.body || '{}');

  try {
    if (method === 'GET') {
      const { search, platform, limit = 50, offset = 0 } = params;
      let q = 'SELECT * FROM creators WHERE 1=1';
      const vals = [];
      if (platform) { vals.push(platform); q += ` AND platform=$${vals.length}`; }
      if (search) { vals.push(`%${search}%`); q += ` AND (username ILIKE $${vals.length} OR niche ILIKE $${vals.length})`; }
      q += ` ORDER BY followers DESC LIMIT $${vals.length+1} OFFSET $${vals.length+2}`;
      vals.push(parseInt(limit), parseInt(offset));
      const r = await pool.query(q, vals);
      const count = await pool.query('SELECT COUNT(*) FROM creators');
      return { statusCode: 200, headers, body: JSON.stringify({ creators: r.rows, total: parseInt(count.rows[0].count) }) };
      }

    if (method === 'POST') {
      const { username, platform, followers, avg_views, engagement_rate, niche, profile_url, notes, tags } = body;
      const r = await pool.query(
        `INSERT INTO creators (username, platform, followers, avg_views, engagement_rate, niche, profile_url, notes, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [username, platform||'tiktok', followers||0, avg_views||0, engagement_rate||0, niche||'', profile_url||'', notes||'', tags||[]]
      );
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, creator: r.rows[0] }) };
             }

    if (method === 'PUT') {
      const { id, ...updates } = body;
      const fields = Object.keys(updates);
      const vals = Object.values(updates);
      vals.push(id);
      const setClause = fields.map((f,i) => `${f}=$${i+1}`).join(', ');
      const r = await pool.query(`UPDATE creators SET ${setClause}, updated_at=NOW() WHERE id=$${fields.length+1} RETURNING *`, vals);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, creator: r.rows[0] }) };
}

    if (method === 'DELETE') {
      await pool.query('DELETE FROM creators WHERE id=$1', [params.id || body.id]);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
} catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
}
};
