/**
 * profileStore.ts
 *
 * Single source of truth for the logged-in user's display name (profiles.name).
 * Per-user localStorage cache for instant paint. A missing name is normal (null),
 * not an error.
 */

import { supabase } from './supabase'

const CACHE_PREFIX = 'disc_name_v2:'

function cacheKey(userId: string): string {
  return `${CACHE_PREFIX}${userId}`
}

/** Instant paint from localStorage. Empty/absent → null. */
export function getCachedName(userId: string): string | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId))
    if (!raw) return null
    const trimmed = raw.trim()
    return trimmed.length > 0 ? trimmed : null
  } catch {
    return null
  }
}

/**
 * Fetch profiles.name for the current session.
 * Uses getSession() (local) — not getUser() (network).
 * Errors and missing rows both resolve to null (name is non-critical).
 */
export async function fetchName(): Promise<string | null> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    console.error('fetchName session error:', sessionError)
    return null
  }
  const userId = sessionData.session?.user?.id
  if (!userId) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('fetchName failed:', error)
    return null
  }

  const name = typeof data?.name === 'string' ? data.name.trim() : ''
  if (!name) return null

  try {
    localStorage.setItem(cacheKey(userId), name)
  } catch {
    // Cache write is best-effort
  }

  return name
}

/** Persist display name via UPDATE (profile row already exists from signup). */
export async function saveName(
  name: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user?.id
  if (!userId) {
    return { ok: false, reason: 'Not signed in' }
  }

  const trimmed = name.trim()
  if (!trimmed) {
    return { ok: false, reason: 'Name is empty' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ name: trimmed })
    .eq('id', userId)

  if (error) {
    console.error('saveName failed:', error)
    return { ok: false, reason: error.message }
  }

  try {
    localStorage.setItem(cacheKey(userId), trimmed)
  } catch {
    // Cache write is best-effort
  }

  return { ok: true }
}

/** Clear per-user name cache. Pass no id to wipe all disc_name_v2:* keys (logout). */
export function clearCachedName(userId?: string): void {
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
