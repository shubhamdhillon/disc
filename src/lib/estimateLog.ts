/**
 * estimateLog.ts — dev-only ring buffer for estimateMeal errors.
 *
 * Every function is guarded by import.meta.env.DEV so Vite's dead-code
 * elimination strips all runtime work from production builds.
 *
 * Nothing here should ever be imported in a production code path; the
 * guards are a belt-and-suspenders safety net.
 */

const MAX_ENTRIES = 20

export interface EstimateLogEntry {
  ts:         number        // Date.now() at the moment of failure
  code:       string        // EstimateErrorCode — string to avoid circular import
  httpStatus: number | null // HTTP status from the API response, or null if unknown
  elapsedMs:  number        // ms from the top of estimateMeal() to this error
  model:      string        // which model was being tried ('—' for pre-request errors)
  detail:     string        // err.message, capped at 120 chars
}

// Mutable ring buffer — module-level, survives navigation within the SPA
const _log: EstimateLogEntry[] = []

/** Append an entry, evicting the oldest if the buffer is full. */
export function logEstimateEntry(entry: EstimateLogEntry): void {
  if (!import.meta.env.DEV) return
  _log.push(entry)
  if (_log.length > MAX_ENTRIES) _log.splice(0, _log.length - MAX_ENTRIES)
}

/** Return a snapshot of all current entries (oldest-first). */
export function getEstimateLog(): readonly EstimateLogEntry[] {
  if (!import.meta.env.DEV) return []
  return [..._log]
}

/** Wipe all entries — called by DevReset. */
export function clearEstimateLog(): void {
  if (!import.meta.env.DEV) return
  _log.splice(0)
}
