const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const OPENAI_KEY = process.env.OPENAI_API_KEY;

async function callOpenAI(messages, model = 'gpt-4o-mini', max_tokens = 800) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, max_tokens, temperature: 0.8 })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return { text: data.choices[0].message.content.trim(), tokens: data.usage?.total_tokens || 0 };
}

async function saveOutput(type, input, output, tokens) {
    try {
          await pool.query(
                  'INSERT INTO ai_outputs (type, input_text, output_text, tokens_used) VALUES ($1,$2,$3,$4)',
                  [type, input, output, tokens]
                );
    } catch(e) { console.error('save output err', e.message); }
}

exports.handler = async (event) => {
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
          const { type, input, context } = JSON.parse(event.body || '{}');
          let result = '';
          let tokens = 0;

      if (type === 'caption') {
              const r = await callOpenAI([
                { role: 'system', content: 'You are an expert TikTok/Instagram content creator. Write viral, engaging captions with emojis and hashtags. Keep it authentic, punchy, and scroll-stopping.' },
                { role: 'user', content: `Write a viral caption for this content: ${input}\n\nContext: ${context || 'TikTok Shop product promotion'}\n\nInclude: hook, value, CTA, and 10-15 relevant hashtags including #ascenddeals` }
                      ]);
              result = r.text; tokens = r.tokens;

      } else if (type === 'hook') {
              const r = await callOpenAI([
                { role: 'system', content: 'You are a viral hook expert. Create scroll-stopping opening lines for TikTok videos that make people stop and watch.' },
                { role: 'user', content: `Generate 5 viral hook variations for: ${input}\n\nMake them: curiosity-driven, pattern interrupts, bold claims, or shocking statements. Each hook under 15 words.` }
                      ]);
              result = r.text; tokens = r.tokens;

      } else if (type === 'script') {
              const r = await callOpenAI([
                { role: 'system', content: 'You are a viral TikTok script writer. Write short, punchy video scripts optimized for TikTok Shop conversions.' },
                { role: 'user', content: `Write a 30-60 second TikTok script for: ${input}\n\nFormat: [HOOK] [PROBLEM] [SOLUTION/PRODUCT] [SOCIAL PROOF] [CTA]\nMake it conversational, authentic, and high-converting.` }
                      ], 'gpt-4o-mini', 1200);
              result = r.text; tokens = r.tokens;

      } else if (type === 'ad_copy') {
              const r = await callOpenAI([
                { role: 'system', content: 'You are a performance marketing expert specializing in TikTok Shop ads and affiliate marketing.' },
                { role: 'user', content: `Write 3 high-converting ad copy variations for: ${input}\n\nInclude: headline, body, and CTA for each. Focus on benefits, urgency, and social proof.` }
                      ]);
              result = r.text; tokens = r.tokens;

      } else if (type === 'product_analysis') {
              const r = await callOpenAI([
                { role: 'system', content: 'You are a TikTok Shop product analyst. Analyze products for viral potential, market fit, and revenue opportunity.' },
                { role: 'user', content: `Analyze this product for TikTok Shop potential:\n${input}\n\nProvide:\n1. Viral Potential Score (1-10)\n2. Target Audience\n3. Best Content Angles\n4. Estimated Market Size\n5. Competition Level\n6. Revenue Potential\n7. Recommended Hashtags\n8. Action Plan` }
                      ], 'gpt-4o-mini', 1500);
              result = r.text; tokens = r.tokens;

      } else if (type === 'trend_prediction') {
              const r = await callOpenAI([
                { role: 'system', content: 'You are a TikTok trend analyst with deep knowledge of viral patterns, seasonal trends, and consumer behavior.' },
                { role: 'user', content: `Predict trends and opportunities for: ${input}\n\nAnalyze:\n1. Current momentum\n2. Peak timing prediction\n3. Audience segments\n4. Content format recommendations\n5. Competition window\n6. Monetization strategies` }
                      ], 'gpt-4o-mini', 1200);
              result = r.text; tokens = r.tokens;

      } else if (type === 'hashtags') {
              const r = await callOpenAI([
                { role: 'system', content: 'You are a hashtag strategy expert for TikTok and Instagram growth.' },
                { role: 'user', content: `Generate optimal hashtag sets for: ${input}\n\nProvide:\n- 5 mega hashtags (1M+ posts)\n- 8 mid-tier hashtags (100K-1M)\n- 7 niche hashtags (<100K)\nAlways include #ascenddeals #tiktokshop` }
                      ]);
              result = r.text; tokens = r.tokens;

      } else {
              return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown type' }) };
      }

      await saveOutput(type, input, result, tokens);
          return { statusCode: 200, headers, body: JSON.stringify({ success: true, result, tokens, type }) };

    } catch(e) {
          return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
};
