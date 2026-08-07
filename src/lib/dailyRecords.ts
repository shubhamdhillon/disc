/**
 * dailyRecords.ts
 *
 * Derives per-day nutrition records from logged meals.
 * Meals are the source of truth — records are always computed, never stored,
 * so they can't drift out of sync.
 * Targets are passed in by the caller (from targetsStore) — no I/O for them.
 */

import { getMeals, type LoggedMeal } from './mealsStore'
import type { Targets, TargetsResolver } from './targetsStore'
import { computeDayVerdict, type DayVerdict } from './dayVerdict'

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
  /** null when no meals logged — nothing to judge */
  verdict: DayVerdict['overall'] | null
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
  targets: Targets,
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

  let verdict: DayVerdict['overall'] | null = null
  if (dayMeals.length > 0) {
    const isToday = toDateKey(date) === toDateKey(new Date())
    // Completed days are judged as if at end of day so the protein floor
    // fully applies. Today is judged at the real current time because it
    // is still in progress.
    const judgeAt = isToday
      ? new Date()
      : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59)
    verdict = computeDayVerdict(dayMeals, targets, judgeAt).overall
  }

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
    verdict,
  }
}

/** Compute a single day's nutrition record from logged meals. */
export async function getDailyRecord(date: Date, resolver: TargetsResolver): Promise<DailyRecord> {
  const meals = await getMeals()
  return computeDailyRecord(meals, date, resolver.forDate(date))
}

/**
 * Fixed Monday–Sunday week records.
 * weekOffset 0 = the Mon–Sun containing today; -1 = previous week, etc.
 * Fetches meals once, then computes all 7 days in memory.
 * Each day is judged against the targets active on that date.
 */
export async function getWeekRecords(weekOffset: number, resolver: TargetsResolver): Promise<DailyRecord[]> {
  const meals = await getMeals()

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
    const targetsForDay = resolver.forDate(d)
    records.push(computeDailyRecord(meals, d, targetsForDay))
  }
  return records
}

/**
 * All daily records for a calendar month (1..daysInMonth).
 * Fetches meals once; each day uses targets active on that date.
 */
export async function getMonthRecords(
  year: number,
  month: number, // 0-indexed, matching Date.getMonth()
  resolver: TargetsResolver,
): Promise<DailyRecord[]> {
  const meals = await getMeals()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const records: DailyRecord[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day)
    const targetsForDay = resolver.forDate(d)
    records.push(computeDailyRecord(meals, d, targetsForDay))
  }
  return records
}

/**
 * Meals and derived record for a single local calendar day (detail view).
 * Fetches meals once, then filters to that day.
 */
export async function getMealsAndRecordForDate(
  date: Date,
  resolver: TargetsResolver,
): Promise<{ meals: LoggedMeal[]; record: DailyRecord }> {
  const meals = await getMeals()
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const end   = start + 24 * 60 * 60 * 1000
  const dayMeals = meals.filter(m => m.timestamp >= start && m.timestamp < end)
  const record = computeDailyRecord(meals, date, resolver.forDate(date))
  return { meals: dayMeals, record }
}

