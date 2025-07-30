// /pages/api/generate-strategies.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      price,
      roi_percent,
      yield_percent,
      location,
      property_type,
      description,
    } = req.body;

    if (!price || !roi_percent || !yield_percent || !location) {
      return res.status(400).json({
        error: 'Missing required property data.',
      });
    }

    const prompt = `
You are a UK-based property investment strategist. Based on the following deal data, suggest 3 smart exit strategies for an investor:

- Price: £${price}
- ROI: ${roi_percent}%
- Yield: ${yield_percent}%
- Location: ${location}
- Property Type: ${property_type || 'Not specified'}
- Description: ${description || 'Not available'}

Use bullet points and 1-sentence explanations.
`;

    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    });

    const reply = chatResponse.choices?.[0]?.message?.content ?? '';

    if (!reply) {
      return res.status(500).json({ strategies: ['No strategies generated.'] });
    }

    const strategies = reply
      .split('\n')
      .filter((line) => line.trim().startsWith('-') || line.trim().match(/^\d+\./))
      .map((line) => line.trim());

    return res.status(200).json({ strategies });
  } catch (error: any) {
    console.error('❌ Strategy generation failed:', error.message);
    return res.status(500).json({ strategies: ['Unable to generate strategies.'] });
  }
}
