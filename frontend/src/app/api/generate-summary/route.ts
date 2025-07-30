import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { price, yield_percent, roi_percent, investmentType } = await req.json();

    const prompt = `
You are a UK property investment strategist. Given the following investment deal, suggest 3 potential exit strategies an investor could consider. Be specific and tailor them to the deal profile.

Details:
- Investment Type: ${investmentType}
- Purchase Price: £${price}
- Gross Yield: ${yield_percent}%
- ROI: ${roi_percent}%

Respond in a concise numbered list, e.g.:

1. ...
2. ...
3. ...
`;

    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4',
      max_tokens: 300,
      temperature: 0.75,
    });

    const raw = completion.choices[0]?.message?.content?.trim();

    const strategies = raw
      ?.split(/\d\.\s/) // Split on numbered points
      .filter((s) => s.trim().length > 0)
      .map((s) => s.trim());

    return NextResponse.json({ strategies });
  } catch (error) {
    console.error('GPT strategy error:', error);
    return NextResponse.json({ strategies: ['Unable to generate strategies.'] }, { status: 500 });
  }
}
