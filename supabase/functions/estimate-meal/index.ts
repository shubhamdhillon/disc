// Edge Function: estimate-meal
// Calls Google Gemini via the @google/genai SDK with the API key held
// server-side as a secret. Requires a valid Supabase session. The SDK
// handles AQ.-format auth keys, which the raw REST endpoint rejects.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { GoogleGenAI, Type } from 'npm:@google/genai@2.15.0'

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const MODELS = ['gemini-3.6-flash', 'gemini-flash-latest']

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    valid:    { type: Type.BOOLEAN },
    name:     { type: Type.STRING },
    calories: { type: Type.INTEGER },
    protein:  { type: Type.INTEGER },
    carbs:    { type: Type.INTEGER },
    fat:      { type: Type.INTEGER },
    sugar:    { type: Type.INTEGER },
    quality:  { type: Type.ARRAY, items: { type: Type.STRING } },
    reason:   { type: Type.STRING },
  },
  required: ['valid', 'sugar'],
}

const SYSTEM_PROMPT = `You are a precise nutrition estimator specialising in Indian home-cooked food.

Given a text description or image of a meal, respond with ONLY a JSON object — no prose, no markdown fences, no extra text.

Assume typical Indian home portion sizes unless quantities are specified:
- Roti / chapati: 35 g each, usually 2 served
- Dal / sabzi / curry: 150 ml per katori (small bowl)
- Cooked rice: 180 g per cup
- Idli: 80 g each, usually 2–3 served
- Dosa: 1 medium (~100 g batter)

Also estimate added sugar in grams (rough estimate is fine).

Classify each meal with one or more of exactly these five tags (lowercase, from this fixed set only):
- "whole": minimally processed / home-cooked (dal, sabzi, roti, rice, fruit)
- "processed": packaged or factory-made (biscuits, chips, instant noodles)
- "sugary": high added sugar (mithai, sweets, desserts, sweetened drinks)
- "fried": deep-fried (samosa, pakora, puri)
- "drink": any calorie-containing beverage (chai, soda, juice, lassi)
A meal can have multiple tags.

For a VALID meal input, respond exactly:
{"valid":true,"name":"...","calories":<int>,"protein":<int>,"carbs":<int>,"fat":<int>,"sugar":<int>,"quality":["<tag>"]}

If the input is NOT a recognisable meal, respond exactly:
{"valid":false,"reason":"not a meal"}

All numeric values must be rounded integers. Macros in grams. Calories in kcal.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  // Require a valid Supabase session
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Parse the app's request: { input: string } or { input: { base64, mimeType } }
  let input: unknown
  try {
    const parsed = await req.json()
    input = parsed.input
  } catch {
    return new Response(JSON.stringify({ error: 'Bad request body' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_KEY })

  const contents =
    typeof input === 'string'
      ? input
      : [{
          role: 'user',
          parts: [
            { text: 'Estimate the nutritional content of this meal.' },
            { inlineData: { mimeType: (input as any).mimeType, data: (input as any).base64 } },
          ],
        }]

  const config = {
    systemInstruction: SYSTEM_PROMPT,
    temperature: 0.1,
    maxOutputTokens: 1024,
    responseMimeType: 'application/json',
    responseJsonSchema: RESPONSE_SCHEMA,
  }

  let lastErr = 'No model available'
  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({ model, contents, config })
      const text = response.text ?? ''
      const finishReason =
        (response as any).candidates?.[0]?.finishReason ?? 'UNKNOWN'
      // Return the essentials the client parser needs
      return new Response(
        JSON.stringify({ text, finishReason }),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[estimate-meal] model ${model} failed:`, msg)
      // 404 / not available → try next model; otherwise bail
      if (msg.includes('not available') || msg.includes('models/') || msg.includes('404')) {
        lastErr = msg
        continue
      }
      return new Response(JSON.stringify({ error: msg }), {
        status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
  }

  return new Response(JSON.stringify({ error: lastErr }), {
    status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
