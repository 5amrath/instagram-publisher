const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

      const method = event.httpMethod;
        const params = event.queryStringParameters || {};
          const body = JSON.parse(event.body || '{}');

            try {
                // GET - list products
                    if (method === 'GET' && !params.id) {
                          const { category, status, search, limit = 50, offset = 0 } = params;
                                let q = 'SELECT * FROM products WHERE 1=1';
                                      const vals = [];
                                            if (category) { vals.push(category); q += ` AND category=$${vals.length}`; }
                                                  if (status) { vals.push(status); q += ` AND status=$${vals.length}`; }
                                                        if (search) { vals.push(`%${search}%`); q += ` AND (name ILIKE $${vals.length} OR notes ILIKE $${vals.length})`; }
                                                              q += ` ORDER BY trending_score DESC, created_at DESC LIMIT $${vals.length+1} OFFSET $${vals.length+2}`;
                                                                    vals.push(parseInt(limit), parseInt(offset));
                                                                          const r = await pool.query(q, vals);
                                                                                const count = await pool.query('SELECT COUNT(*) FROM products');
                                                                                      return { statusCode: 200, headers, body: JSON.stringify({ products: r.rows, total: parseInt(count.rows[0].count) }) };
                                                                                          }

                                                                                              // GET single
                                                                                                  if (method === 'GET' && params.id) {
                                                                                                        const r = await pool.query('SELECT * FROM products WHERE id=$1', [params.id]);
                                                                                                              return { statusCode: 200, headers, body: JSON.stringify(r.rows[0] || null) };
                                                                                                                  }
                                                                                                                  
                                                                                                                      // POST - create product
                                                                                                                          if (method === 'POST') {
                                                                                                                                const { name, url, category, price, estimated_sales, revenue_estimate, views_7d, likes_7d, engagement_rate, growth_velocity, ad_saturation, creator_count, trending_score, platform, thumbnail_url, notes, tags, status } = body;
                                                                                                                                      const r = await pool.query(
                                                                                                                                              `INSERT INTO products (name,url,category,price,estimated_sales,revenue_estimate,views_7d,likes_7d,engagement_rate,growth_velocity,ad_saturation,creator_count,trending_score,platform,thumbnail_url,notes,tags,status)
                                                                                                                                                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
                                                                                                                                                               [name,url,category,price||0,estimated_sales||0,revenue_estimate||0,views_7d||0,likes_7d||0,engagement_rate||0,growth_velocity||0,ad_saturation||0,creator_count||0,trending_score||0,platform||'tiktok',thumbnail_url,'',notes||'',tags||[],status||'tracking']
                                                                                                                                                                     );
                                                                                                                                                                           return { statusCode: 200, headers, body: JSON.stringify({ success: true, product: r.rows[0] }) };
                                                                                                                                                                               }
                                                                                                                                                                               
                                                                                                                                                                                   // PUT - update product
                                                                                                                                                                                       if (method === 'PUT') {
                                                                                                                                                                                             const { id, ...updates } = body;
                                                                                                                                                                                                   const fields = Object.keys(updates);
                                                                                                                                                                                                         const vals = Object.values(updates);
                                                                                                                                                                                                               vals.push(id);
                                                                                                                                                                                                                     const setClause = fields.map((f,i) => `${f}=$${i+1}`).join(', ');
                                                                                                                                                                                                                           const r = await pool.query(`UPDATE products SET ${setClause}, updated_at=NOW() WHERE id=$${fields.length+1} RETURNING *`, vals);
                                                                                                                                                                                                                                 return { statusCode: 200, headers, body: JSON.stringify({ success: true, product: r.rows[0] }) };
                                                                                                                                                                                                                                     }
                                                                                                                                                                                                                                     
                                                                                                                                                                                                                                         // DELETE
                                                                                                                                                                                                                                             if (method === 'DELETE') {
                                                                                                                                                                                                                                                   await pool.query('DELETE FROM products WHERE id=$1', [params.id || body.id]);
                                                                                                                                                                                                                                                         return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
                                                                                                                                                                                                                                                             }
                                                                                                                                                                                                                                                             
                                                                                                                                                                                                                                                                 return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
                                                                                                                                                                                                                                                                   } catch(e) {
                                                                                                                                                                                                                                                                       return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
                                                                                                                                                                                                                                                                         }
                                                                                                                                                                                                                                                                         };
