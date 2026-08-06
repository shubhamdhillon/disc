/**
 * dailyRecords.ts
 *
 * Derives per-day nutrition records from logged meals.
 * Meals are the source of truth — records are always computed, never stored,
 * so they can't drift out of sync.
 */

import { getMeals, type LoggedMeal } from './mealsStore'

export interface DailyRecord {
  date: string              // 'YYYY-MM-DD' local
  totalCals: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  totalSugar: number
  qualityTagCounts: Record<string, number>  // e.g. { sugary: 2, fried: 1 }
  targetSnapshot: { calories: number; protein: number; carbs: number; fat: number }
  hitCalorieGoal: boolean   // true if totalCals within ±10% of target calories
  mealCount: number
}

interface MacroTargets {
  calories: number
  protein:  number
  carbs:    number
  fat:      number
}

const DEFAULT_TARGETS: MacroTargets = {
  calories: 2180,
  protein:  145,
  carbs:    240,
  fat:      65,
}

/** Same loading path as Today.tsx — localStorage 'disc_targets' with fallbacks. */
function loadTargets(): MacroTargets {
  try {
    const raw = localStorage.getItem('disc_targets')
    if (raw) {
      const t = JSON.parse(raw)
      if (t?.calories && t?.protein) return t as MacroTargets
    }
  } catch {
    // fall through to defaults
  }
  return { ...DEFAULT_TARGETS }
}

/** Local calendar day as YYYY-MM-DD. */
function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Pure: compute a day's record from an already-fetched meals array. */
function computeDailyRecord(
  meals: LoggedMeal[],
  date: Date,
  targets: MacroTargets,
): DailyRecord {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const end   = start + 24 * 60 * 60 * 1000
  const dayMeals = meals.filter(m => m.timestamp >= start && m.timestamp < end)

  let totalCals    = 0
  let totalProtein = 0
  let totalCarbs   = 0
  let totalFat     = 0
  let totalSugar   = 0
  const qualityTagCounts: Record<string, number> = {}

  for (const m of dayMeals) {
    totalCals    += m.calories ?? 0
    totalProtein += m.protein  ?? 0
    totalCarbs   += m.carbs    ?? 0
    totalFat     += m.fat      ?? 0
    totalSugar   += m.sugar    ?? 0
    for (const tag of m.quality ?? []) {
      qualityTagCounts[tag] = (qualityTagCounts[tag] ?? 0) + 1
    }
  }

  const mealCount = dayMeals.length
  const target    = targets.calories
  const hitCalorieGoal =
    mealCount > 0 && Math.abs(totalCals - target) <= target * 0.10

  return {
    date: toDateKey(date),
    totalCals,
    totalProtein,
    totalCarbs,
    totalFat,
    totalSugar,
    qualityTagCounts,
    targetSnapshot: {
      calories: targets.calories,
      protein:  targets.protein,
      carbs:    targets.carbs,
      fat:      targets.fat,
    },
    hitCalorieGoal,
    mealCount,
  }
}

/** Compute a single day's nutrition record from logged meals. */
export async function getDailyRecord(date: Date): Promise<DailyRecord> {
  const meals = await getMeals()
  const targets = loadTargets()
  return computeDailyRecord(meals, date, targets)
}

/**
 * Fixed Monday–Sunday week records.
 * weekOffset 0 = the Mon–Sun containing today; -1 = previous week, etc.
 * Fetches meals once, then computes all 7 days in memory.
 */
export async function getWeekRecords(weekOffset = 0): Promise<DailyRecord[]> {
  const meals = await getMeals()
  const targets = loadTargets()

  const today = new Date()
  // Anchor in the requested week (today shifted by weekOffset × 7 days)
  const anchor = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + weekOffset * 7,
  )

  // Monday as first day: Sunday (getDay()===0) → Monday is 6 days earlier
  const day = anchor.getDay()
  const daysSinceMonday = day === 0 ? 6 : day - 1
  const monday = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate() - daysSinceMonday,
  )

  const records: DailyRecord[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + i,
    )
    records.push(computeDailyRecord(meals, d, targets))
  }
  return records
}
