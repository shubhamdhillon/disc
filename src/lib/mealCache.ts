/**
 * mealCache.ts
 *
 * Exact-match cache of previously estimated meals, keyed by normalized input.
 * Repeat identical descriptions skip the Gemini API.
 * No quantity scaling, no fuzzy/semantic matching — out of scope.
 */

export interface CachedMeal {
  name:     string
  calories: number
  protein:  number
  carbs:    number
  fat:      number
  sugar:    number
  quality:  string[]
  useCount: number
  lastUsed: number   // Date.now()
}

const STORAGE_KEY = 'disc_meal_cache'
const MAX_ENTRIES = 200

/** Hindi/English pairs → one canonical token. Extend by hand; keep literal. */
export const SYNONYMS: Record<string, string> = {
  chawal:  'rice',
  cheeni:  'sugar',
  roti:    'roti',
  chapati: 'roti',
  aloo:    'potato',
  paneer:  'paneer',
  dahi:    'curd',
  doodh:   'milk',
  anda:    'egg',
  ande:    'egg',
  chai:    'tea',
}

type CacheStore = Record<string, CachedMeal>

function readStore(): CacheStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as CacheStore
    }
    return {}
  } catch {
    return {}
  }
}

function writeStore(store: CacheStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Quota exceeded or storage unavailable — no-op
  }
}

/** Evict until at or under MAX_ENTRIES: lowest useCount first, then oldest lastUsed. */
function evictIfNeeded(store: CacheStore): void {
  const keys = Object.keys(store)
  if (keys.length <= MAX_ENTRIES) return

  const ranked = keys.sort((a, b) => {
    const A = store[a]
    const B = store[b]
    if (A.useCount !== B.useCount) return A.useCount - B.useCount
    return A.lastUsed - B.lastUsed
  })

  const toRemove = ranked.length - MAX_ENTRIES
  for (let i = 0; i < toRemove; i++) {
    delete store[ranked[i]]
  }
}

/**
 * Normalize raw meal text into a cache key.
 * Numbers/quantities are preserved — "2 roti" and "5 roti" are different keys.
 * Word order is sorted so "1 scoop whey" and "1 whey scoop" match.
 * Internal punctuation (+, commas, dashes, etc.) is stripped so it never
 * becomes a token that splits otherwise-identical phrases.
 */
export function normalizeInput(raw: string): string {
  let s = raw.toLowerCase().trim()
  // Drop all punctuation — keep letters, digits, and spaces only
  s = s.replace(/[^a-z0-9\s]/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  const words = s.split(' ').filter(Boolean)
  return words
    .map(w => SYNONYMS[w] ?? w)
    .sort()
    .join(' ')
}

/** Exact key match only after normalization. Null on miss or storage failure. */
export function lookupMeal(raw: string): CachedMeal | null {
  try {
    const key = normalizeInput(raw)
    if (!key) return null
    const store = readStore()
    return store[key] ?? null
  } catch {
    return null
  }
}

/** Upsert under normalized key. Latest estimate wins; increments useCount. */
export function cacheMeal(
  raw: string,
  meal: {
    name:     string
    calories: number
    protein:  number
    carbs:    number
    fat:      number
    sugar:    number
    quality:  string[]
  },
): void {
  try {
    const key = normalizeInput(raw)
    if (!key) return

    const store = readStore()
    const existing = store[key]
    const now = Date.now()

    store[key] = {
      name:     meal.name,
      calories: meal.calories,
      protein:  meal.protein,
      carbs:    meal.carbs,
      fat:      meal.fat,
      sugar:    meal.sugar,
      quality:  meal.quality,
      useCount: existing ? existing.useCount + 1 : 1,
      lastUsed: now,
    }

    evictIfNeeded(store)
    writeStore(store)
  } catch {
    // no-op
  }
}

/** Cached meals by popularity, then recency. Empty array on failure. */
export function getFrequentMeals(limit = 5): CachedMeal[] {
  try {
    const store = readStore()
    return Object.values(store)
      .sort((a, b) => {
        if (b.useCount !== a.useCount) return b.useCount - a.useCount
        return b.lastUsed - a.lastUsed
      })
      .slice(0, limit)
  } catch {
    return []
  }
}
