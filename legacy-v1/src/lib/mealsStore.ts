/**
 * mealsStore.ts
 *
 * Supabase-backed meal persistence. Meals are per-user (RLS).
 * Callers must await read/write helpers.
 */

import { supabase } from './supabase'

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): LoggedMeal {
  return {
    id:        row.id,
    name:      row.name,
    calories:  row.calories,
    protein:   row.protein,
    carbs:     row.carbs,
    fat:       row.fat,
    sugar:     row.sugar,
    quality:   row.quality ?? [],
    timestamp: new Date(row.logged_at).getTime(),
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** All logged meals, newest first. */
export async function getMeals(): Promise<LoggedMeal[]> {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .order('logged_at', { ascending: false })
  if (error) { console.error('getMeals failed:', error); return [] }
  return (data ?? []).map(mapRow)
}

/** Meals logged on a specific calendar date (local time). */
export async function getMealsForDate(date: Date): Promise<LoggedMeal[]> {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .gte('logged_at', start.toISOString())
    .lt('logged_at', end.toISOString())
    .order('logged_at', { ascending: false })
  if (error) { console.error('getMealsForDate failed:', error); return [] }
  return (data ?? []).map(mapRow)
}

/** Meals logged today (convenience wrapper). */
export async function getTodaysMeals(): Promise<LoggedMeal[]> {
  return getMealsForDate(new Date())
}

// ── Write ─────────────────────────────────────────────────────────────────────

/** Persist a new meal. Returns the saved record, or null on failure. */
export async function addMeal(
  meal: Pick<LoggedMeal, 'name' | 'calories' | 'protein' | 'carbs' | 'fat' | 'sugar' | 'quality'>,
): Promise<LoggedMeal | null> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) { console.error('addMeal: no logged-in user'); return null }
  const { data, error } = await supabase
    .from('meals')
    .insert({
      user_id: userId,
      name: meal.name,
      calories: meal.calories,
      protein: meal.protein ?? 0,
      carbs: meal.carbs ?? 0,
      fat: meal.fat ?? 0,
      sugar: meal.sugar ?? 0,
      quality: meal.quality ?? [],
    })
    .select()
    .single()
  if (error) { console.error('addMeal failed:', error); return null }
  return {
    id: data.id, name: data.name, calories: data.calories,
    protein: data.protein, carbs: data.carbs, fat: data.fat,
    sugar: data.sugar, quality: data.quality ?? [],
    timestamp: new Date(data.logged_at).getTime(),
  }
}

/** Remove a meal by id. */
export async function removeMeal(id: string): Promise<void> {
  const { error } = await supabase.from('meals').delete().eq('id', id)
  if (error) console.error('removeMeal failed:', error)
}

/** Re-insert a previously removed meal (same id + timestamp). */
export async function restoreMeal(meal: LoggedMeal): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return
  const { error } = await supabase.from('meals').insert({
    id: meal.id,
    user_id: userId,
    name: meal.name, calories: meal.calories, protein: meal.protein,
    carbs: meal.carbs, fat: meal.fat, sugar: meal.sugar,
    quality: meal.quality,
    logged_at: new Date(meal.timestamp).toISOString(),
  })
  if (error) console.error('restoreMeal failed:', error)
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
