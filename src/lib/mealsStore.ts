/**
 * mealsStore.ts
 *
 * Thin localStorage wrapper for logged meals.
 * Today.tsx reads from this store; AddMealSheet writes to it.
 * Replace with a server / SQLite layer later without changing call sites.
 */

export interface LoggedMeal {
  id:        string   // uuid
  name:      string
  calories:  number
  protein:   number   // grams
  carbs:     number   // grams
  fat:       number   // grams
  sugar:     number   // grams, rough estimate
  quality:   string[] // classification tags
  timestamp: number   // Date.now() — ms since epoch
}

const STORAGE_KEY = 'disc_meals'

// ── Read ──────────────────────────────────────────────────────────────────────

/** All logged meals, newest first. */
export function getMeals(): LoggedMeal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LoggedMeal[]) : []
  } catch {
    return []
  }
}

/** Meals logged on a specific calendar date (local time). */
export function getMealsForDate(date: Date): LoggedMeal[] {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const end   = start + 24 * 60 * 60 * 1000
  return getMeals().filter(m => m.timestamp >= start && m.timestamp < end)
}

/** Meals logged today (convenience wrapper). */
export function getTodaysMeals(): LoggedMeal[] {
  return getMealsForDate(new Date())
}

// ── Write ─────────────────────────────────────────────────────────────────────

/** Persist a new meal. Returns the saved record with generated id + timestamp. */
export function addMeal(
  meal: Pick<LoggedMeal, 'name' | 'calories' | 'protein' | 'carbs' | 'fat' | 'sugar' | 'quality'>,
): LoggedMeal {
  const record: LoggedMeal = {
    ...meal,
    sugar:     meal.sugar   ?? 0,
    quality:   meal.quality ?? [],
    id:        crypto.randomUUID(),
    timestamp: Date.now(),
  }
  const existing = getMeals()
  existing.unshift(record)   // newest first
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
  return record
}

// ── Aggregation ───────────────────────────────────────────────────────────────

/** Sum all four macros across an array of meals. */
export function sumMacros(meals: LoggedMeal[]): {
  calories: number
  protein:  number
  carbs:    number
  fat:      number
} {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein:  acc.protein  + (m.protein  ?? 0),
      carbs:    acc.carbs    + (m.carbs    ?? 0),
      fat:      acc.fat      + (m.fat      ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format a meal's timestamp as a human-readable time string (e.g. "1:30 PM"). */
export function formatMealTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour:   'numeric',
    minute: '2-digit',
  })
}
