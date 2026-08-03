/**
 * estimateMeal.ts
 *
 * Calls the Google Gemini API via the @google/genai SDK.
 *
 * Auth   : SDK sends the API key via "x-goog-api-key" header — compatible
 *          with both legacy AIza… keys and the new AQ.Ab… auth-key format.
 * Model  : gemini-3.6-flash (primary) → gemini-flash-latest (fallback).
 *          If the primary returns 404 "not available", the fallback is tried
 *          silently so one retired model never breaks the feature.
 * Output : responseJsonSchema + responseMimeType enforce valid JSON output.
 *
 * Every failure emits a tagged console line: [estimateMeal] <CODE> …
 */

import { GoogleGenAI, Type } from '@google/genai'
import { logEstimateEntry } from './estimateLog'

const TAG = '[estimateMeal]'

// ── Models ────────────────────────────────────────────────────────────────────

// Ordered list — tried left-to-right, stopping on first success.
// gemini-3.6-flash: confirmed stable and available to new AQ.Ab… accounts.
// gemini-flash-latest: Google-maintained alias, always points to a working model.
const MODELS = ['gemini-3.6-flash', 'gemini-flash-latest'] as const

const TIMEOUT_MS = 15_000

// ── Typed error ───────────────────────────────────────────────────────────────

export type EstimateErrorCode =
  | 'NO_API_KEY'            // VITE_GEMINI_API_KEY missing / empty
  | 'AUTH_FAILURE'          // 401 / 403
  | 'RATE_LIMITED'          // 429
  | 'NETWORK_ERROR'         // fetch failed — offline / DNS / refused
  | 'TIMEOUT'               // no response within TIMEOUT_MS
  | 'EMPTY_RESPONSE'        // model returned no text (finishReason in console)
  | 'SAFETY_BLOCK'          // response blocked by safety filters
  | 'PARSE_FAILED'          // response was not parseable JSON (raw in console)
  | 'MODEL_NOT_AVAILABLE'   // 404 "retired for new users" on all models in chain
  | 'API_ERROR'             // any other non-2xx error

export class EstimateError extends Error {
  readonly code:       EstimateErrorCode
  readonly httpStatus: number | null
  constructor(code: EstimateErrorCode, detail: string, httpStatus: number | null = null) {
    super(detail)
    this.name       = 'EstimateError'
    this.code       = code
    this.httpStatus = httpStatus
  }
}

// ── Public types ───────────────────────────────────────────────────────────────

export interface MealEstimate {
  name:     string
  calories: number
  protein:  number
  carbs:    number
  fat:      number
  sugar:    number      // rough estimate, grams
  quality:  string[]    // classification tags
}

export type EstimateResult =
  | ({ valid: true } & MealEstimate)
  | { valid: false; reason: string }

export interface ImageInput {
  base64:   string   // raw base64, no "data:image/…" prefix
  mimeType: string   // e.g. 'image/jpeg'
}

// ── Schema ────────────────────────────────────────────────────────────────────

// Constrains the model to emit valid JSON matching this shape.
// responseMimeType alone only hints at JSON — the schema enforces it.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    valid:    { type: Type.BOOLEAN },
    name:     { type: Type.STRING  },
    calories: { type: Type.INTEGER },
    protein:  { type: Type.INTEGER },
    carbs:    { type: Type.INTEGER },
    fat:      { type: Type.INTEGER },
    sugar:    { type: Type.INTEGER },
    quality:  { type: Type.ARRAY, items: { type: Type.STRING } },
    reason:   { type: Type.STRING  },
  },
  required: ['valid', 'sugar'],
}

const SYSTEM_PROMPT = `\
You are a precise nutrition estimator specialising in Indian home-cooked food.

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
A meal can have multiple tags (e.g. kaju katli → ["sugary","processed"]; samosa → ["fried","processed"]; dal → ["whole"]).

For a VALID meal input, respond exactly:
{"valid":true,"name":"...","calories":<int>,"protein":<int>,"carbs":<int>,"fat":<int>,"sugar":<int>,"quality":["<tag>"]}

If the input is NOT a recognisable meal (gibberish, random letters, non-food text) respond exactly:
{"valid":false,"reason":"not a meal"}

All numeric values must be rounded integers. Macros in grams. Calories in kcal.`

// ── Helpers ───────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => {
      console.error(`${TAG} TIMEOUT — no response after ${ms / 1000}s`)
      reject(new EstimateError('TIMEOUT', `Request timed out after ${ms / 1000}s`))
    }, ms)
    promise.then(
      v => { clearTimeout(id); resolve(v) },
      e => { clearTimeout(id); reject(e) },
    )
  })
}

function buildApiError(err: unknown): EstimateError {
  if (err instanceof EstimateError) return err

  const msg = err instanceof Error ? err.message : String(err)

  if (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError')    ||
    msg.includes('net::ERR')        ||
    msg.includes('ECONNREFUSED')    ||
    msg.includes('ERR_INTERNET_DISCONNECTED')
  ) {
    console.error(`${TAG} NETWORK_ERROR —`, msg)
    return new EstimateError('NETWORK_ERROR', msg)
  }

  try {
    const parsed = JSON.parse(msg.replace(/^ApiError:\s*/i, '').trim()) as {
      error: { code: number; message: string; status: string }
    }
    const { code, status, message: apiMsg } = parsed.error

    if (code === 401 || code === 403 || status === 'UNAUTHENTICATED' || status === 'PERMISSION_DENIED') {
      console.error(`${TAG} AUTH_FAILURE http=${code} status=${status}`)
      return new EstimateError('AUTH_FAILURE', apiMsg, code)
    }
    if (code === 429 || status === 'RESOURCE_EXHAUSTED') {
      console.error(`${TAG} RATE_LIMITED http=${code}`)
      return new EstimateError('RATE_LIMITED', apiMsg, code)
    }
    if (code === 404 && (apiMsg.includes('no longer available') || apiMsg.includes('models/'))) {
      console.warn(`${TAG} MODEL_NOT_AVAILABLE http=${code} — ${apiMsg}`)
      return new EstimateError('MODEL_NOT_AVAILABLE', apiMsg, code)
    }
    console.error(`${TAG} API_ERROR http=${code} status=${status} —`, apiMsg)
    return new EstimateError('API_ERROR', `API error (${code}): ${apiMsg}`, code)
  } catch { /* message was not JSON */ }

  console.error(`${TAG} API_ERROR (unclassified) —`, err)
  return new EstimateError('API_ERROR', msg)
}

function extractJson(raw: string): Record<string, unknown> {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  try { return JSON.parse(stripped) as Record<string, unknown> } catch { /* next */ }

  const m = stripped.match(/\{[\s\S]*\}/)
  if (m) {
    try { return JSON.parse(m[0]) as Record<string, unknown> } catch { /* next */ }
  }

  console.error(`${TAG} PARSE_FAILED raw="${raw.slice(0, 200)}"`)
  throw new EstimateError('PARSE_FAILED', 'Model response was not valid JSON')
}

function parseResponse(raw: string): EstimateResult {
  const obj = extractJson(raw)

  if (!obj.valid) {
    const reason = String(obj.reason ?? 'not a meal')
    console.info(`${TAG} NOT_A_MEAL — model says: "${reason}"`)
    return { valid: false, reason }
  }

  return {
    valid:    true,
    name:     String(obj.name     ?? 'Unnamed meal'),
    calories: Math.round(Number(obj.calories ?? 0)),
    protein:  Math.round(Number(obj.protein  ?? 0)),
    carbs:    Math.round(Number(obj.carbs    ?? 0)),
    fat:      Math.round(Number(obj.fat      ?? 0)),
    sugar:    Math.round(Number(obj.sugar    ?? 0)),
    quality:  Array.isArray(obj.quality)
                ? obj.quality.filter((t): t is string => typeof t === 'string')
                : [],
  }
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function estimateMeal(
  input: string | ImageInput,
): Promise<EstimateResult> {
  // t0 is used to compute elapsedMs for every failure entry in the dev log
  const t0 = performance.now()

  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim()
  if (!apiKey) {
    console.error(`${TAG} NO_API_KEY — VITE_GEMINI_API_KEY is not set in .env`)
    const err = new EstimateError('NO_API_KEY', 'VITE_GEMINI_API_KEY is not set')
    if (import.meta.env.DEV) logEstimateEntry({ ts: Date.now(), code: 'NO_API_KEY', httpStatus: null, elapsedMs: 0, model: '—', detail: err.message })
    throw err
  }

  const ai = new GoogleGenAI({ apiKey })

  const contents =
    typeof input === 'string'
      ? input
      : [
          {
            role: 'user',
            parts: [
              { text: 'Estimate the nutritional content of this meal.' },
              { inlineData: { mimeType: input.mimeType, data: input.base64 } },
            ],
          },
        ]

  const config = {
    systemInstruction:  SYSTEM_PROMPT,
    temperature:        0.1,
    maxOutputTokens:    1024,
    responseMimeType:   'application/json',
    responseJsonSchema: RESPONSE_SCHEMA,
  }

  let lastErr: EstimateError | null = null

  for (const model of MODELS) {
    let response: Awaited<ReturnType<typeof ai.models.generateContent>>

    try {
      response = await withTimeout(
        ai.models.generateContent({ model, contents, config }),
        TIMEOUT_MS,
      )
    } catch (err) {
      const apiErr = buildApiError(err)
      // Log every network/API/timeout failure with http status and elapsed time.
      // This makes it possible to distinguish e.g. a 429 from a genuine timeout.
      if (import.meta.env.DEV) {
        logEstimateEntry({
          ts:         Date.now(),
          code:       apiErr.code,
          httpStatus: apiErr.httpStatus,
          elapsedMs:  Math.round(performance.now() - t0),
          model,
          detail:     apiErr.message.slice(0, 120),
        })
      }
      if (apiErr.code === 'MODEL_NOT_AVAILABLE') {
        lastErr = apiErr
        const next = MODELS[MODELS.indexOf(model) + 1]
        console.warn(`${TAG} MODEL_NOT_AVAILABLE "${model}"${next ? ` — trying "${next}"` : ' — no more fallbacks'}`)
        continue
      }
      throw apiErr
    }

    const text         = response.text ?? ''
    const finishReason = String(
      (response as { candidates?: Array<{ finishReason?: string }> })
        .candidates?.[0]?.finishReason ?? 'UNKNOWN',
    )
    const usage = (response as {
      usageMetadata?: { candidatesTokenCount?: number; promptTokenCount?: number }
    }).usageMetadata

    // Diagnostic prefix shared by every PARSE_FAILED log entry for this response.
    // "finish=MAX_TOKENS tokens=41/1024" — lets us see if truncation caused the error.
    const parseDiag = [
      `finish=${finishReason}`,
      usage?.candidatesTokenCount !== undefined
        ? `tokens=${usage.candidatesTokenCount}/1024`
        : null,
    ].filter(Boolean).join(' ')

    if (!text) {
      let emptyErr: EstimateError
      if (finishReason === 'SAFETY') {
        console.error(`${TAG} SAFETY_BLOCK — content filtered by safety system`)
        emptyErr = new EstimateError('SAFETY_BLOCK', 'Response blocked by safety filters')
      } else {
        console.error(`${TAG} EMPTY_RESPONSE finishReason=${finishReason}`, response)
        emptyErr = new EstimateError('EMPTY_RESPONSE', `Empty response (finishReason: ${finishReason})`)
      }
      if (import.meta.env.DEV) {
        logEstimateEntry({
          ts:         Date.now(),
          code:       emptyErr.code,
          httpStatus: null,
          elapsedMs:  Math.round(performance.now() - t0),
          model,
          detail:     emptyErr.message,
        })
      }
      throw emptyErr
    }

    // Non-STOP finish with text means the response was cut off (e.g. MAX_TOKENS).
    // Skip the parser — it will fail on truncated JSON — and throw directly.
    if (finishReason !== 'STOP') {
      const detail = `${parseDiag} — Not valid JSON — raw: ${text.slice(0, 200)}`
      console.error(`${TAG} PARSE_FAILED finishReason=${finishReason}`, text.slice(0, 200))
      const truncErr = new EstimateError('PARSE_FAILED', detail)
      if (import.meta.env.DEV) {
        logEstimateEntry({
          ts:         Date.now(),
          code:       'PARSE_FAILED',
          httpStatus: null,
          elapsedMs:  Math.round(performance.now() - t0),
          model,
          detail,
        })
      }
      throw truncErr
    }

    // finishReason === 'STOP' — attempt to parse, log if it still fails
    try {
      return parseResponse(text)
    } catch (parseErr) {
      if (import.meta.env.DEV && parseErr instanceof EstimateError) {
        logEstimateEntry({
          ts:         Date.now(),
          code:       parseErr.code,
          httpStatus: null,
          elapsedMs:  Math.round(performance.now() - t0),
          model,
          detail:     parseErr.code === 'PARSE_FAILED'
                        ? `${parseDiag} — Not valid JSON — raw: ${text.slice(0, 200)}`
                        : parseErr.message.slice(0, 120),
        })
      }
      throw parseErr
    }
  }

  console.error(`${TAG} MODEL_NOT_AVAILABLE — all models exhausted: [${MODELS.join(', ')}]`)
  throw lastErr ?? new EstimateError('MODEL_NOT_AVAILABLE', 'No available model found')
}
