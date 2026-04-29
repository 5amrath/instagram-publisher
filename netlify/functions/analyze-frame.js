const { OpenAI } = require('openai');

const FALLBACKS = [
  "this is why everyone is switching.\n\nlink in bio.\n\n#deals #musthave #trending #viral #discount #save #affiliate #fyp",
  "stop sleeping on this.\n\nlink in bio.\n\n#deals #trending #musthave #viral #save #discount #affiliate #tiktokmademebuyit",
  "pov: you finally stopped overpaying.\n\nlink in bio.\n\n#deals #frugal #savemoney #trending #viral #discount #musthave #affiliate",
  "this changed everything.\n\nlink in bio.\n\n#deals #musthave #trending #viral #discount #save #affiliatemarketing #fyp",
  "you need to see this before it sells out.\n\nlink in bio.\n\n#deals #limited #trending #viral #musthave #discount #save #affiliate",
];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { imageUrl } = JSON.parse(event.body || '{}');
    if (!imageUrl) {
      return { statusCode: 400, body: JSON.stringify({ error: 'imageUrl required' }) };
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 220,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl, detail: 'low' },
            },
            {
              type: 'text',
              text: `You write Instagram Reels captions that go viral. Look at this product image and write a caption.

Rules:
- Use a proven hook formula (examples: "this is why you're broke", "stop doing this", "pov: you finally found it", "this is the reason everyone is switching", "you've been doing it wrong")
- All lowercase, no exclamation marks, no emojis in the hook
- 1-2 short punchy sentences max before the CTA
- End with: link in bio.
- Then 6-8 hashtags on a new line including #deals #ascenddeals and relevant tags

Output ONLY the caption text, nothing else.`,
            },
          ],
        },
      ],
    });

    const caption = response.choices[0]?.message?.content?.trim();
    if (!caption) throw new Error('Empty response from AI');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption }),
    };
  } catch (err) {
    console.error('analyze-frame error:', err.message);
    const fallback = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: fallback, fallback: true }),
    };
  }
};
