/**
 * estimateLog.ts — dev-only ring buffer for estimateMeal errors.
 *
 * Every function is guarded by import.meta.env.DEV so Vite's dead-code
 * elimination strips all runtime work from production builds.
 *
 * Nothing here should ever be imported in a production code path; the
 * guards are a belt-and-suspenders safety net.
 *
 * Entries are persisted to localStorage so they survive page reloads.
 */

const MAX_ENTRIES = 20
const STORAGE_KEY = 'disc_estimate_log'

export interface EstimateLogEntry {
  ts:         number        // Date.now() at the moment of failure
  code:       string        // EstimateErrorCode — string to avoid circular import
  httpStatus: number | null // HTTP status from the API response, or null if unknown
  elapsedMs:  number        // ms from the top of estimateMeal() to this error
  model:      string        // which model was being tried ('—' for pre-request errors)
  detail:     string        // err.message, capped at 120 chars
}

// ── Persistence helpers ───────────────────────────────────────────────────────

function readFromStorage(): EstimateLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as EstimateLogEntry[]) : []
  } catch {
    return []
  }
}

function writeToStorage(entries: EstimateLogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch { /* storage full or unavailable — silently ignore */ }
}

// ── Mutable ring buffer ───────────────────────────────────────────────────────
// Hydrated from localStorage on module load; all writes go back immediately.

const _log: EstimateLogEntry[] = import.meta.env.DEV ? readFromStorage() : []

// ── Public API ────────────────────────────────────────────────────────────────

/** Append an entry, evicting the oldest if the buffer is full. */
export function logEstimateEntry(entry: EstimateLogEntry): void {
  if (!import.meta.env.DEV) return
  _log.push(entry)
  if (_log.length > MAX_ENTRIES) _log.splice(0, _log.length - MAX_ENTRIES)
  writeToStorage(_log)
}

/** Return a snapshot of all current entries (oldest-first). */
export function getEstimateLog(): readonly EstimateLogEntry[] {
  if (!import.meta.env.DEV) return []
  return [..._log]
}

/** Wipe all entries and clear the localStorage key — called by DevReset. */
export function clearEstimateLog(): void {
  if (!import.meta.env.DEV) return
  _log.splice(0)
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}
