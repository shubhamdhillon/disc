/**
 * estimateMeal.ts
 *
 * Calls the estimate-meal Supabase Edge Function, which runs Gemini server-side.
 * Requires a signed-in session (Bearer token).
 *
 * Every failure emits a tagged console line: [estimateMeal] <CODE> …
 */

import { logEstimateEntry } from './estimateLog'
import { supabase } from './supabase'

const TAG = '[estimateMeal]'

const TIMEOUT_MS = 15_000

// ── Typed error ───────────────────────────────────────────────────────────────

export type EstimateErrorCode =
  | 'NO_API_KEY'            // legacy — key no longer lives in the client
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

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) {
    console.error(`${TAG} NO_SESSION — user is not signed in`)
    const err = new EstimateError('AUTH_FAILURE', 'Not signed in')
    if (import.meta.env.DEV) logEstimateEntry({ ts: Date.now(), code: 'AUTH_FAILURE', httpStatus: 401, elapsedMs: 0, model: '—', detail: err.message })
    throw err
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const fnUrl = `${supabaseUrl}/functions/v1/estimate-meal`

  let response: Response
  try {
    response = await withTimeout(
      fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ input }),
      }),
      TIMEOUT_MS,
    )
  } catch (err) {
    const apiErr = buildApiError(err)
    if (import.meta.env.DEV) logEstimateEntry({ ts: Date.now(), code: apiErr.code, httpStatus: apiErr.httpStatus, elapsedMs: Math.round(performance.now() - t0), model: 'edge', detail: apiErr.message.slice(0, 120) })
    throw apiErr
  }

  if (!response.ok) {
    let detail = `Edge function returned ${response.status}`
    try { const e = await response.json(); if (e?.error) detail = String(e.error) } catch {}
    const code = response.status === 401 ? 'AUTH_FAILURE'
               : response.status === 429 ? 'RATE_LIMITED'
               : 'API_ERROR'
    console.error(`${TAG} ${code} http=${response.status} — ${detail}`)
    const apiErr = new EstimateError(code, detail, response.status)
    if (import.meta.env.DEV) logEstimateEntry({ ts: Date.now(), code, httpStatus: response.status, elapsedMs: Math.round(performance.now() - t0), model: 'edge', detail: detail.slice(0, 120) })
    throw apiErr
  }

  const payload = await response.json() as { text?: string; finishReason?: string }
  const text = payload.text ?? ''
  const finishReason = payload.finishReason ?? 'UNKNOWN'

  if (!text) {
    const emptyErr = new EstimateError(
      finishReason === 'SAFETY' ? 'SAFETY_BLOCK' : 'EMPTY_RESPONSE',
      finishReason === 'SAFETY' ? 'Response blocked by safety filters' : `Empty response (finishReason: ${finishReason})`,
    )
    if (import.meta.env.DEV) logEstimateEntry({ ts: Date.now(), code: emptyErr.code, httpStatus: null, elapsedMs: Math.round(performance.now() - t0), model: 'edge', detail: emptyErr.message })
    throw emptyErr
  }

  if (finishReason !== 'STOP') {
    const detail = `finish=${finishReason} — Not valid JSON — raw: ${text.slice(0, 200)}`
    console.error(`${TAG} PARSE_FAILED finishReason=${finishReason}`, text.slice(0, 200))
    const truncErr = new EstimateError('PARSE_FAILED', detail)
    if (import.meta.env.DEV) logEstimateEntry({ ts: Date.now(), code: 'PARSE_FAILED', httpStatus: null, elapsedMs: Math.round(performance.now() - t0), model: 'edge', detail })
    throw truncErr
  }

  try {
    return parseResponse(text)
  } catch (parseErr) {
    if (import.meta.env.DEV && parseErr instanceof EstimateError) {
      logEstimateEntry({ ts: Date.now(), code: parseErr.code, httpStatus: null, elapsedMs: Math.round(performance.now() - t0), model: 'edge', detail: parseErr.message.slice(0, 120) })
    }
    throw parseErr
  }
}
