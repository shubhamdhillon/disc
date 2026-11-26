/**
 * calculateTargets.ts
 *
 * Derives a user's daily calorie and protein targets from their onboarding
 * answers. Each step is broken into its own small function so the logic is
 * easy to read, audit, and adjust without touching anything else.
 *
 * Flow:
 *   1. Age          — from birth date
 *   2. BMR          — Mifflin-St Jeor (calories burned at total rest)
 *   3. Activity     — lifestyle multiplier from work-day type + step count
 *   4. Exercise     — daily average calories from deliberate training
 *   5. TDEE         — BMR × activity + exercise  (total daily energy expenditure)
 *   6. Goal offset  — calorie surplus/deficit for the chosen goal
 *   7. Protein      — grams/day from bodyweight + training status
 *   8. Carbs/Fat    — fill remaining calories using standard ratio splits
 *   9. Round        — calories → 10, protein/carbs/fat → nearest 5
 */

import type { OnboardingData } from '../context/OnboardingContext'

export interface Targets {
  calories: number   // kcal/day
  protein:  number   // grams/day
  carbs:    number   // grams/day
  fat:      number   // grams/day
}

// ─── Step 1: Exact age in whole years ─────────────────────────────────────────
function calcAge(birthYear: number, birthMonth: number, birthDay: number): number {
  const today = new Date()
  let age = today.getFullYear() - birthYear
  const birthdayPassedThisYear =
    today.getMonth() + 1 > birthMonth ||
    (today.getMonth() + 1 === birthMonth && today.getDate() >= birthDay)
  if (!birthdayPassedThisYear) age -= 1
  return age
}

// ─── Step 2: Basal Metabolic Rate — Mifflin-St Jeor (1990) ───────────────────
// The most widely validated single-number estimate of resting calorie burn.
// Units: weight in kg, height in cm, age in years → kcal/day.
//
//   Male:   10W + 6.25H − 5A + 5
//   Female: 10W + 6.25H − 5A − 161
//   Other:  average of the two sex constants  (+5 and −161) → −78
function calcBMR(
  weightKg: number,
  heightCm: number,
  age:      number,
  gender:   OnboardingData['gender'],
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  if (gender === 'male')   return base + 5
  if (gender === 'female') return base - 161
  return base - 78   // neutral: midpoint of male and female offsets
}

// ─── Step 3: Lifestyle activity multiplier ────────────────────────────────────
// Covers non-exercise movement: the job, commute, household chores, etc.
// We collect TWO independent signals (work-day type and step count) and
// average them so they correct each other if one is unusually high or low.
//
// Multiplier scale: 1.30 (sedentary) → 1.75 (very physically active).
// These sit between the classic "sedentary" (1.2) and "active" (1.725) PAL
// values — appropriate because exercise is accounted for separately in step 4.

const WORKDAY_FACTOR: Record<string, number> = {
  'Mostly sitting':            1.30,
  'Mix of sitting and moving': 1.45,
  'On feet most of the day':   1.60,
  'Physical work':             1.75,
}

const STEPS_FACTOR: Record<string, number> = {
  'Under 3k': 1.30,
  '3k-6k':    1.45,
  '6k-10k':   1.60,
  '10k+':     1.75,
}

function calcActivityMultiplier(
  workDay:     string | null,
  stepsPerDay: string | null,
): number {
  // Fall back to "lightly active" (1.45) for any unanswered signal
  const w = workDay     ? (WORKDAY_FACTOR[workDay]     ?? 1.45) : 1.45
  const s = stepsPerDay ? (STEPS_FACTOR[stepsPerDay]   ?? 1.45) : 1.45
  return (w + s) / 2
}

// ─── Step 4: Deliberate exercise calories (daily average) ────────────────────
// Structured workouts are kept separate from lifestyle to avoid double-counting.
//
// Frequency sets a base cal/day spread over 7 days — e.g. training 3-4×/week
// at moderate intensity burns ~150 extra cal when averaged daily.
//
// Session length scales the base: shorter sessions burn less, longer burn more.
// The modifiers span 0.7→1.6 (±30-60% of the base) to keep the range realistic.

const FREQ_BASE_CAL: Record<string, number> = {
  'No':            0,
  '1-2 days/week': 75,
  '3-4 days/week': 150,
  '5-6 days/week': 200,
}

const LENGTH_MODIFIER: Record<string, number> = {
  'Under 30 min': 0.70,
  '30-60 min':    1.00,
  '60-90 min':    1.30,
  '90 min+':      1.60,
}

function calcExerciseCal(
  workoutFrequency: string | null,
  workoutLength:    string | null,
): number {
  const base = workoutFrequency ? (FREQ_BASE_CAL[workoutFrequency] ?? 0) : 0
  const mod  = workoutLength    ? (LENGTH_MODIFIER[workoutLength]  ?? 1) : 1
  return base * mod
}

// ─── Step 5: TDEE (total daily energy expenditure) ───────────────────────────
// TDEE = BMR × lifestyle multiplier + deliberate exercise calories

// ─── Step 6: Goal-based calorie offset ───────────────────────────────────────
// Applied to TDEE to produce the user's daily calorie target.
//
// -400 kcal deficit ≈ 0.4 kg fat loss per week — meaningful but sustainable.
// +250 kcal surplus is conservative enough to limit fat gain during a bulk.
// Recomposition sits at maintenance; macros (specifically protein) do the work.

const GOAL_OFFSET: Record<string, number> = {
  'Lose fat':           -400,
  'Maintain':              0,
  'Build muscle':        +250,
  'Body recomposition':    0,
}

// ─── Step 7: Daily protein target ────────────────────────────────────────────
// Evidence-based recommendations (Morton et al., 2018; Phillips, 2012):
//   - Training:     1.8 g/kg — supports muscle protein synthesis and repair
//   - Sedentary:    1.4 g/kg — comfortably above the RDA (0.8 g/kg), ensures
//                             satiety and lean mass preservation during a cut
//
// Vegetarian/vegan users get the same gram target; the UI can later flag this
// and suggest plant-protein sources (that's why we track dietPreference).
function calcProtein(weightKg: number, doesTrain: boolean): number {
  return weightKg * (doesTrain ? 1.8 : 1.4)
}

// ─── Step 8: Carbs and fat from remaining calories ────────────────────────────
// Protein is fixed first (highest priority macro).
// Carbs fill ~45% of total calories — moderate-carb split, works for most goals.
// Fat takes whatever remains after protein and carbs are accounted for.
// All rounded to the nearest 5 g so targets feel clean, not artificially precise.
function calcCarbsFat(
  calories: number,
  protein:  number,
): { carbs: number; fat: number } {
  const carbs = Math.round((calories * 0.45) / 4 / 5) * 5  // 45% of kcal → grams

  const proteinCal  = protein * 4
  const carbCal     = carbs   * 4
  const remainingCal = calories - proteinCal - carbCal
  const fat          = Math.max(5, Math.round(remainingCal / 9 / 5) * 5)

  return { carbs, fat }
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function calculateTargets(data: OnboardingData): Targets {
  const age = calcAge(data.birthYear, data.birthMonth, data.birthDay)
  const bmr = calcBMR(data.weightKg, data.heightCm, age, data.gender)

  const activityMult = calcActivityMultiplier(data.workDay, data.stepsPerDay)
  const exerciseCal  = calcExerciseCal(data.workoutFrequency, data.workoutLength)

  const tdee       = bmr * activityMult + exerciseCal
  const goalOffset = data.goal ? (GOAL_OFFSET[data.goal] ?? 0) : 0

  const doesTrain  = !!data.workoutFrequency && data.workoutFrequency !== 'No'
  const rawProtein = calcProtein(data.weightKg, doesTrain)

  const calories = Math.round((tdee + goalOffset) / 10) * 10
  const protein  = Math.round(rawProtein           /  5) *  5
  const { carbs, fat } = calcCarbsFat(calories, protein)

  return { calories, protein, carbs, fat }
}
