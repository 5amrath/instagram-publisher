const https = require('https');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { imageUrl } = body;
  if (!imageUrl) {
    return { statusCode: 400, body: JSON.stringify({ error: 'imageUrl required' }) };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: fallbackCaption() }),
    };
  }

  try {
    const caption = await analyzeWithVision(apiKey, imageUrl);
    console.log('[analyze-frame] Generated caption:', caption.substring(0, 80) + '...');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption }),
    };
  } catch (err) {
    console.error('[analyze-frame] Error:', err.message);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: fallbackCaption() }),
    };
  }
};

async function analyzeWithVision(apiKey, imageUrl) {
  const payload = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You write Instagram Reels captions for @ascend.deals — a male self-improvement and affiliate deals account focused on looksmaxxing, skincare, grooming, and lifestyle products.

RULES:
- First line MUST be a short punchy hook (under 10 words). This is what people see before "...more"
- Hook styles that work: "This is why you're not ___", "Stop doing ___ wrong", "The ___ nobody talks about", "You need this if ___", "I tested ___ for 30 days", "POV: you finally ___", "This changed everything", "Why does nobody know about this"
- After the hook: 1-2 short lines of value or intrigue
- End with "Link in bio" or "Check bio"
- Then 6-8 hashtags on a new line
- NO emojis. NO exclamation marks. Keep it lowercase energy
- Sound like a real person, not a brand. Think TikTok voice
- Total caption under 120 words

HASHTAG RULES:
- Mix broad reach tags (#fyp #viral #trending) with niche tags (#looksmax #skincare #mog)
- Always include #ascenddeals
- 6-8 hashtags total, no more`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Look at this video thumbnail. Identify what the product/topic is, then write a Reels caption following the rules. Make the hook irresistible — something that stops the scroll.',
          },
          {
            type: 'image_url',
            image_url: { url: imageUrl, detail: 'low' },
          },
        ],
      },
    ],
    max_tokens: 250,
    temperature: 0.9,
  });

  const result = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error('Invalid OpenAI response')); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(25000, () => { req.destroy(); reject(new Error('OpenAI timeout')); });
    req.write(payload);
    req.end();
  });

  if (result.error) {
    throw new Error(result.error.message || 'OpenAI API error');
  }

  if (result.choices && result.choices[0] && result.choices[0].message) {
    return result.choices[0].message.content.trim();
  }

  return fallbackCaption();
}

function fallbackCaption() {
  const hooks = [
    "this is why you look the same every month",
    "stop skipping this in your routine",
    "the one product that actually changed my skin",
    "nobody talks about this but it works",
    "you need this if you're serious about your glow up",
    "I tested this for 2 weeks straight",
    "POV: you finally found what works",
    "this is the difference between trying and results",
    "your routine is missing this one thing",
    "the product everyone is sleeping on right now",
  ];

  const bodies = [
    "most people overlook this. don't be most people.",
    "the results speak for themselves.",
    "this is what separates average from elite.",
    "once you try it you won't go back.",
    "every detail matters when you're leveling up.",
  ];

  const tagSets = [
    "#looksmax #skincare #glowup #mog #ascenddeals #fyp #viral #selfcare",
    "#looksmax #grooming #selfimprovement #mog #ascenddeals #fyp #trending #skincare",
    "#skincare #looksmaxxing #deals #glowup #ascenddeals #fyp #viral #routine",
    "#looksmax #forwardgrowth #maxila #mog #ascenddeals #fyp #viral #skincare",
  ];

  const hook = hooks[Math.floor(Math.random() * hooks.length)];
  const body = bodies[Math.floor(Math.random() * bodies.length)];
  const tags = tagSets[Math.floor(Math.random() * tagSets.length)];

  return `${hook}\n\n${body}\n\nlink in bio\n\n${tags}`;
}
