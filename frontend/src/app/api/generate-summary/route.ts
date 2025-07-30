import { NextRequest } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { title, location, price, yield_percent, roi_percent, investmentType, propertyType } = body;

    const prompt = `
You are a UK property investment expert. Summarise the deal below for a beginner investor in 2-3 sentences:
Title: ${title}
Location: ${location}
Price: £${price}
Yield: ${yield_percent}%
ROI: ${roi_percent}%
Type: ${propertyType}
Strategy: ${investmentType}
`;

    const response = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4", // use gpt-3.5-turbo if limited
      temperature: 0.7,
    });

    const summary = response.choices[0]?.message?.content || "No summary generated.";
    return new Response(JSON.stringify({ summary }), { status: 200 });
  } catch (err) {
    console.error("❌ GPT error:", err);
    return new Response(JSON.stringify({ summary: "Unable to generate summary." }), { status: 500 });
  }
}
