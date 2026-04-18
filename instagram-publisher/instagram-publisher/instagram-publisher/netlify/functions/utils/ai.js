const https = require('https');

async function generateCaption(context = '') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallbackCaption();
  }

  const prompt = context
    ? `Write a short, engaging Instagram caption for a post about: ${context}. Include 5-8 relevant hashtags. Keep it under 150 words. No emojis.`
    : `Write a short, engaging Instagram caption for an affiliate product post. The account promotes deals and discounts. Include 5-8 relevant hashtags. Keep it under 150 words. No emojis.`;

  try {
    const payload = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a social media copywriter for an Instagram deals and affiliate account called @ascend.deals. Write punchy, conversion-focused captions.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 300,
      temperature: 0.8,
    });

    const result = await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.openai.com',
          path: '/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
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
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('OpenAI timeout')); });
      req.write(payload);
      req.end();
    });

    if (result.choices && result.choices[0] && result.choices[0].message) {
      return result.choices[0].message.content.trim();
    }

    return fallbackCaption();
  } catch (err) {
    console.error('AI caption error:', err.message);
    return fallbackCaption();
  }
}

function fallbackCaption() {
  const captions = [
    "Don't sleep on this deal. Link in bio.\n\n#deals #discount #save #musthave #trending #viral #affiliate",
    "This one's a game changer. Grab it before it's gone.\n\n#bestdeals #limitedtime #shopping #dailydeals #savings #smart #value",
    "Level up with this find. Details in bio.\n\n#upgrade #lifestyle #deals #smart #quality #trending #musthave",
    "Price dropped. Act fast.\n\n#sale #clearance #deals #savings #bestprice #shopping #value #limited",
    "Found this gem. You're welcome.\n\n#hidden #gem #deals #steals #affiliate #shopping #quality #find",
  ];
  return captions[Math.floor(Math.random() * captions.length)];
}

module.exports = { generateCaption, fallbackCaption };
