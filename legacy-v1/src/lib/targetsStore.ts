/**
 * targetsStore.ts
 *
 * Single source of truth for the logged-in user's macro targets.
 * Reads from Supabase `targets`, with a per-user localStorage cache for
 * instant paint only. No hardcoded default target values.
 */

import { supabase } from './supabase'

export interface Targets {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type TargetsResult =
  | { status: 'ok'; targets: Targets; stale: boolean }
  | { status: 'missing' }
  | { status: 'error'; message: string }

const CACHE_PREFIX = 'disc_targets_v2:'

function cacheKey(userId: string): string {
  return `${CACHE_PREFIX}${userId}`
}

function isValidTargets(value: unknown): value is Targets {
  if (!value || typeof value !== 'object') return false
  const t = value as Record<string, unknown>
  return (
    typeof t.calories === 'number' && Number.isFinite(t.calories) &&
    typeof t.protein  === 'number' && Number.isFinite(t.protein)  &&
    typeof t.carbs    === 'number' && Number.isFinite(t.carbs)    &&
    typeof t.fat      === 'number' && Number.isFinite(t.fat)
  )
}

/** Instant paint from localStorage. Never invents defaults. */
export function getCachedTargets(userId: string): Targets | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isValidTargets(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Fetch the latest targets row for the current session.
 * Uses getSession() (local) — not getUser() (network).
 * Relies on RLS for user scoping; maybeSingle() so zero rows ≠ error.
 */
export async function fetchTargets(): Promise<TargetsResult> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    console.error('fetchTargets session error:', sessionError)
    return { status: 'error', message: sessionError.message }
  }
  const userId = sessionData.session?.user?.id
  if (!userId) {
    return { status: 'error', message: 'Not signed in' }
  }

  const { data, error } = await supabase
    .from('targets')
    .select('calories, protein, carbs, fat')
    .order('effective_from', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('fetchTargets failed:', error)
    return { status: 'error', message: error.message }
  }

  if (data === null) {
    return { status: 'missing' }
  }

  const targets: Targets = {
    calories: data.calories,
    protein:  data.protein,
    carbs:    data.carbs,
    fat:      data.fat,
  }

  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(targets))
  } catch {
    // Cache write is best-effort — don't fail the fetch
  }

  return { status: 'ok', targets, stale: false }
}

/** Clear per-user cache. Pass no id to wipe all disc_targets_v2:* keys (logout). */
export function clearCachedTargets(userId?: string): void {
  if (userId) {
    localStorage.removeItem(cacheKey(userId))
    return
  }
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(CACHE_PREFIX)) toRemove.push(key)
  }
  for (const key of toRemove) localStorage.removeItem(key)
}

export interface TargetsResolver {
  /** Targets active on the given local date. */
  forDate(date: Date): Targets
}

export type TargetsHistoryResult =
  | { status: 'ok'; resolver: TargetsResolver }
  | { status: 'missing' }
  | { status: 'error'; message: string }

/** Local calendar day as YYYY-MM-DD — never parse effective_from as UTC. */
function toLocalDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

type TargetsRow = Targets & { effective_from: string }

/**
 * Fetch all targets rows and build a date→targets resolver for past-day judging.
 * Relies on RLS for user scoping, same as fetchTargets.
 */
export async function fetchTargetsHistory(): Promise<TargetsHistoryResult> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    console.error('fetchTargetsHistory session error:', sessionError)
    return { status: 'error', message: sessionError.message }
  }
  const userId = sessionData.session?.user?.id
  if (!userId) {
    return { status: 'error', message: 'Not signed in' }
  }

  const { data, error } = await supabase
    .from('targets')
    .select('calories, protein, carbs, fat, effective_from, created_at')
    .order('effective_from', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('fetchTargetsHistory failed:', error)
    return { status: 'error', message: error.message }
  }

  if (!data || data.length === 0) {
    return { status: 'missing' }
  }

  const rows: TargetsRow[] = data.map(row => ({
    calories: row.calories,
    protein:  row.protein,
    carbs:    row.carbs,
    fat:      row.fat,
    effective_from: row.effective_from,
  }))

  const resolver: TargetsResolver = {
    forDate(date: Date): Targets {
      const dateKey = toLocalDateKey(date)
      // Last row whose effective_from is on or before dateKey
      let chosen: TargetsRow | null = null
      for (const row of rows) {
        if (row.effective_from <= dateKey) {
          chosen = row
        } else {
          break // rows are oldest-first; later ones are after this date
        }
      }
      // Before earliest effective_from → deliberate fallback to earliest row
      const pick = chosen ?? rows[0]
      return {
        calories: pick.calories,
        protein:  pick.protein,
        carbs:    pick.carbs,
        fat:      pick.fat,
      }
    },
  }

  return { status: 'ok', resolver }
}
