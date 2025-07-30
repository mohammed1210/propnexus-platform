import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Must be set in your Vercel env
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'A valid prompt is required.' });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert investment analyst. Summarize UK property deals for investors in 2–3 short, punchy sentences. Highlight ROI, yield, and area strength.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const summary = response.choices[0]?.message?.content?.trim() || 'Summary unavailable.';
    res.status(200).json({ summary });
  } catch (error: any) {
    console.error('❌ OpenAI API error:', error.message || error);
    res.status(500).json({ error: 'Failed to generate summary.' });
  }
}
