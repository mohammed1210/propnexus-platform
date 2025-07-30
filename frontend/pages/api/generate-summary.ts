// /pages/api/generate-summary.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { property } = req.body;

  if (
    !property ||
    !property.price ||
    !property.yield_percent ||
    !property.roi_percent
  ) {
    return res
      .status(400)
      .json({ strategies: ['Unable to generate strategies.'] });
  }

  try {
    const prompt = `
You are an expert property investment advisor. Based on the following deal data, write a short summary (2-3 sentences) of this investment opportunity.

Property Details:
- Location: ${property.location}
- Price: £${property.price}
- Yield: ${property.yield_percent}%
- ROI: ${property.roi_percent}%
- Bedrooms: ${property.bedrooms}
- Bathrooms: ${property.bathrooms}
- Type: ${property.property_type || 'Not specified'}

Respond with a short, engaging investment summary.
`;

    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    });

    const responseText = chatResponse.choices[0]?.message?.content?.trim();

    if (!responseText) {
      return res
        .status(500)
        .json({ summary: 'Unable to generate summary.' });
    }

    res.status(200).json({ summary: responseText });
  } catch (error: any) {
    console.error('❌ OpenAI error:', error.message || error);
    res.status(500).json({ summary: 'Unable to generate summary.' });
  }
}
