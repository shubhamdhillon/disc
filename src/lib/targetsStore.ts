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
