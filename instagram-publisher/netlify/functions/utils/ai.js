const https = require('https');

async function generateCaption(context = '') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackCaption();

  const userMsg = context
    ? `Write a Reels caption for: ${context}. Use a scroll-stopping hook. Pick the best angle for this product.`
    : `Write a Reels caption for a random looksmaxxing/skincare/grooming product. Pick a specific product type (serum, retinol, sunscreen, peptides, moisturizer, hair product, jawline tool, posture corrector). Make the hook irresistible.`;

  try {
    const payload = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You write Instagram Reels captions for @ascend.deals — a male self-improvement and affiliate deals account. Looksmaxxing, skincare, grooming, forward growth, lifestyle products.

RULES:
- First line = short punchy hook (under 10 words). Shows before "...more"
- Hook formulas that work: "This is why you're not ___", "Stop doing ___ wrong", "The ___ nobody talks about", "You need this if ___", "POV: you finally ___", "This changed everything", "Why does nobody know about this"
- 1-2 short lines after hook with value or intrigue
- End with "Link in bio"
- 6-8 hashtags on new line
- NO emojis. NO exclamation marks. Lowercase energy
- Sound like a real person, not a brand
- Under 100 words total
- Always include #ascenddeals
- Mix broad tags (#fyp #viral) with niche (#looksmax #mog #skincare)`,
        },
        { role: 'user', content: userMsg },
      ],
      max_tokens: 200,
      temperature: 1.0,
    });

    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(payload),
        },
      }, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Bad response')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
      req.write(payload);
      req.end();
    });

    if (result.choices?.[0]?.message?.content) {
      return result.choices[0].message.content.trim();
    }
    return fallbackCaption();
  } catch {
    return fallbackCaption();
  }
}

function fallbackCaption() {
  const captions = [
    "stop sleeping on this\n\nthe results speak for themselves. this is what consistency looks like.\n\nlink in bio\n\n#looksmax #skincare #glowup #mog #ascenddeals #fyp #viral #selfcare",
    "this is why your skin hasn't changed\n\nyou're missing the one step that actually matters.\n\nlink in bio\n\n#looksmax #skincare #routine #mog #ascenddeals #fyp #trending #glowup",
    "nobody talks about this but it works\n\nevery detail matters when you're leveling up. don't skip this.\n\nlink in bio\n\n#looksmax #grooming #selfimprovement #mog #ascenddeals #fyp #viral #deals",
    "POV: you finally take your routine seriously\n\nonce you try it you won't go back.\n\nlink in bio\n\n#looksmax #skincare #glowup #selfcare #ascenddeals #fyp #viral #mog",
    "the product everyone is sleeping on\n\nthis changed my entire routine. not even exaggerating.\n\nlink in bio\n\n#skincare #looksmaxxing #deals #glowup #ascenddeals #fyp #viral #routine",
  ];
  return captions[Math.floor(Math.random() * captions.length)];
}

module.exports = { generateCaption, fallbackCaption };
