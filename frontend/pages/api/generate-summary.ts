// /pages/api/generate-strategies.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { Configuration, OpenAIApi } from 'openai'

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
})
const openai = new OpenAIApi(configuration)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { property } = req.body

  if (!property || !property.price || !property.yield_percent || !property.roi_percent) {
    return res.status(400).json({ strategies: ['Unable to generate strategies.'] })
  }

  try {
    const prompt = `
You are an expert property investment advisor. Based on the following deal data, suggest 3 smart exit strategies tailored to this property.

Property Details:
- Location: ${property.location}
- Price: £${property.price}
- Yield: ${property.yield_percent}%
- ROI: ${property.roi_percent}%
- Bedrooms: ${property.bedrooms}
- Bathrooms: ${property.bathrooms}

Include strategy type and 1 sentence explanation for each.`;

    const completion = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = completion.data.choices[0].message?.content || ''

    // Convert GPT output into an array (split by linebreak or bullet)
    const strategies = responseText
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => line.replace(/^\d+\.\s*/, '').trim())

    res.status(200).json({ strategies })
  } catch (error) {
    console.error('OpenAI error:', error)
    res.status(500).json({ strategies: ['Unable to generate strategies.'] })
  }
}
