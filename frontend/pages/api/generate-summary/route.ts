import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { property } = await req.json();

    const prompt = `You are an investment assistant. Summarize this UK buy-to-let property in one paragraph for a smart investor. Mention location, price, yield, ROI, and why it might be a good deal.\n\nProperty details:\nTitle: ${property.title}\nLocation: ${property.location}\nPrice: £${property.price}\nYield: ${property.yield_percent}%\nROI: ${property.roi_percent}%\nType: ${property.propertyType}\nInvestment Strategy: ${property.investmentType}`;

    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4',
      max_tokens: 150,
      temperature: 0.7,
    });

    const summary = completion.choices[0]?.message?.content?.trim();
    return NextResponse.json({ summary });
  } catch (error) {
    console.error('GPT summary error:', error);
    return NextResponse.json({ summary: 'Error generating summary.' }, { status: 500 });
  }
}
