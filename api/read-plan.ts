import { GoogleGenAI, Type } from '@google/genai'

/*
  Reads a diet or fitness plan from a photo or PDF and pulls out the daily
  numbers. Runs on Vercel (free), so the Gemini key never reaches the phone.
  Needs GEMINI_API_KEY set in Vercel → Settings → Environment Variables.
*/

const MODELS = ['gemini-flash-lite-latest', 'gemini-flash-latest']
const MAX_BYTES = 4 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']

const PROMPT = `You are reading a person's diet or fitness plan (from a dietitian, coach, gym or app).
Pull out their DAILY targets. Rules:
- If the plan states daily calories or protein, use those numbers exactly and set "estimated" to false.
- If it only lists meals and portions, estimate daily calories and protein from those meals (typical Indian portions if unclear) and set "estimated" to true.
- workoutDays: training days per week, only if the plan says so.
- waterLitres: daily water, only if the plan says so.
- If something isn't there, leave it out. Never guess workout days or water.
- summary: one short, friendly sentence (max 15 words) describing the plan, e.g. "A 1,800 calorie veg plan with 5 meals a day".
- If this is not a diet or fitness plan at all, set notAPlan to true.`

const schema = {
  type: Type.OBJECT,
  properties: {
    notAPlan: { type: Type.BOOLEAN },
    calories: { type: Type.NUMBER },
    protein: { type: Type.NUMBER },
    estimated: { type: Type.BOOLEAN },
    workoutDays: { type: Type.NUMBER },
    waterLitres: { type: Type.NUMBER },
    summary: { type: Type.STRING },
  },
  required: ['notAPlan'],
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export async function POST(request: Request): Promise<Response> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return json({ error: 'not-set-up' }, 503)

  let body: { data?: string; mimeType?: string }
  try { body = await request.json() } catch { return json({ error: 'bad-request' }, 400) }
  const { data, mimeType } = body
  if (!data || !mimeType || !ALLOWED.includes(mimeType)) return json({ error: 'unsupported' }, 400)
  if (data.length * 0.75 > MAX_BYTES) return json({ error: 'too-big' }, 413)

  const ai = new GoogleGenAI({ apiKey: key })
  for (const model of MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data } }, { text: PROMPT }] }],
        config: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0 },
      })
      const out = JSON.parse(res.text ?? '{}')
      // Keep numbers sensible; drop anything out of range rather than pass it on
      const inRange = (n: unknown, lo: number, hi: number) => (typeof n === 'number' && n >= lo && n <= hi ? Math.round(n) : undefined)
      return json({
        notAPlan: !!out.notAPlan,
        calories: inRange(out.calories, 800, 6000),
        protein: inRange(out.protein, 20, 400),
        estimated: !!out.estimated,
        workoutDays: inRange(out.workoutDays, 0, 7),
        waterMl: typeof out.waterLitres === 'number' && out.waterLitres >= 0.5 && out.waterLitres <= 8 ? Math.round(out.waterLitres * 1000) : undefined,
        summary: typeof out.summary === 'string' ? out.summary.slice(0, 120) : undefined,
      })
    } catch (e) {
      const msg = String(e)
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) return json({ error: 'busy' }, 429)
      // Model not available on this key: try the next one
      if (msg.includes('404') || msg.includes('not found') || msg.includes('not available')) continue
      return json({ error: 'failed' }, 502)
    }
  }
  return json({ error: 'failed' }, 502)
}
