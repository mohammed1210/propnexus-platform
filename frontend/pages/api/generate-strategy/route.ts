import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { property } = await req.json();

    const prompt = `You are a UK property investment strategist. Based on the details below, suggest 3 potential exit strategies. Consider flipping, refinancing, rental yield, or long-term capital growth. Be concise and practical.\n\nProperty:\nTitle: ${property.title}\nLocation: ${property.location}\nPrice: £${property.price}\nYield: ${property.yield_percent}%\nROI: ${property.roi_percent}%\nType: ${property.propertyType}\nInvestment Strategy: ${property.investmentType}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
    });

    const output = completion.choices[0]?.message?.content?.trim();
    return NextResponse.json({ strategies: output });
  } catch (error) {
    console.error('GPT strategy error:', error);
    return NextResponse.json({ error: 'Failed to generate strategies' }, { status: 500 });
  }
}
