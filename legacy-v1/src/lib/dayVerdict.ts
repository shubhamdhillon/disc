import type { Targets } from './targetsStore'
import type { LoggedMeal } from './mealsStore'
import type { DayPattern } from './dayPattern'
import { pickCoachLine } from './coachPicker'

export type AxisStatus = 'fine' | 'warn' | 'bad'

export interface DayVerdict {
  overall: 'good' | 'warn' | 'bad'
  protein: AxisStatus
  fat: AxisStatus
  sugar: AxisStatus
  calories: AxisStatus // budget: 'bad' only when clearly over
  boxedIn: boolean // can't hit remaining protein without going over calories
  consumed: {
    calories: number
    protein: number
    carbs: number
    fat: number
    sugar: number
  }
  /** One-line coach message — highest-priority truth right now */
  coachLine: string
  /** Structured coach message naming every current issue */
  coach: {
    severity: 'good' | 'warn' | 'bad'
    headline: string
    body: string
  }
}

/** Placeholder daily sugar ceiling (g) until targets include sugar. Revisit. */
const SUGAR_CEILING = 40

function axisCeiling(pct: number): AxisStatus {
  if (pct > 1.0) return 'bad'
  if (pct >= 0.8) return 'warn'
  return 'fine'
}

/**
 * Coach brain: judge a day from meals, targets, and current time.
 * Not pure — pickCoachLine reads/writes localStorage for line rotation.
 */
export function computeDayVerdict(
  meals: LoggedMeal[],
  targets: Targets,
  now: Date,
  pattern?: DayPattern,
): DayVerdict {
  const consumed = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    sugar: 0,
  }

  for (const meal of meals) {
    consumed.calories += meal.calories
    consumed.protein += meal.protein
    consumed.carbs += meal.carbs
    consumed.fat += meal.fat
    consumed.sugar += meal.sugar ?? 0
  }

  if (meals.length === 0) {
    return {
      overall: 'good',
      protein: 'fine',
      fat: 'fine',
      sugar: 'fine',
      calories: 'fine',
      boxedIn: false,
      consumed,
      coachLine: '',
      coach: { severity: 'good', headline: '', body: '' },
    }
  }

  const late = now.getHours() >= 18

  // BOXED-IN — remaining calories can't fit remaining protein (~4 kcal/g)
  const caloriesLeft = targets.calories - consumed.calories
  const proteinLeft = Math.max(0, targets.protein - consumed.protein)
  const boxedIn = proteinLeft > 0 && caloriesLeft / 4 < proteinLeft

  // PROTEIN — floor; only under is bad (and only judged hard when late)
  const pctProtein = consumed.protein / targets.protein
  const pctCal = consumed.calories / targets.calories
  let protein: AxisStatus
  if (late) {
    if (pctProtein < 0.7) protein = 'bad'
    else if (pctProtein < 0.8) protein = 'warn'
    else protein = 'fine'
  } else {
    // Before noon, a protein shortfall is not yet a fault. From midday on,
    // being badly behind is worth surfacing.
    const afterNoon = now.getHours() >= 12
    protein = (afterNoon && pctProtein < 0.4) ? 'warn' : 'fine'
  }

  // Pace check — goal-relative, not time-relative.
  // If calories are being spent much faster than protein is being banked,
  // the day is going wrong even if it's early and still arithmetically fixable.
  const gap = pctCal - pctProtein // both are 0..1 fractions
  if (pctCal >= 0.7 && gap > 0.4) {
    protein = 'bad'
  } else if (pctCal >= 0.5 && gap > 0.3) {
    // only escalate, never downgrade an existing 'bad'
    if (protein !== 'bad') protein = 'warn'
  }

  // Unrecoverable protein miss = bad at any hour, not just late
  if (boxedIn && pctProtein < 0.8) {
    protein = 'bad'
  }

  // FAT — ceiling
  const fat = axisCeiling(consumed.fat / targets.fat)

  // SUGAR — ceiling against fixed placeholder (targets has no sugar field yet)
  const sugar = axisCeiling(consumed.sugar / SUGAR_CEILING)

  // CALORIES — budget; no early front-loading penalty
  let calories: AxisStatus
  if (pctCal > 1.1) calories = 'bad'
  else if (pctCal > 1.0) calories = 'warn'
  else calories = 'fine'

  // Red meals — same as mealTier: quality includes 'sugary' or 'fried'
  let redMealCount = 0
  for (const meal of meals) {
    const tags = meal.quality ?? []
    if (tags.includes('sugary') || tags.includes('fried')) redMealCount += 1
  }

  // OVERALL — calories-over and protein-miss weigh heaviest
  let overall: DayVerdict['overall']
  if (
    calories === 'bad' ||
    protein === 'bad' ||
    redMealCount >= 2 ||
    (fat === 'bad' && sugar === 'bad')
  ) {
    overall = 'bad'
  } else if (
    calories === 'warn' ||
    protein === 'warn' ||
    fat === 'bad' ||
    fat === 'warn' ||
    sugar === 'bad' ||
    sugar === 'warn' ||
    redMealCount === 1 ||
    boxedIn
  ) {
    overall = 'warn'
  } else {
    overall = 'good'
  }

  // Coach state — pattern first, then today's worst issue
  let state: string | null = null
  let vars: Record<string, string | number> = {}

  if (pattern && pattern.kind !== 'steady') {
    if (pattern.kind === 'chronic') {
      state = 'CHRONIC'
      vars = { axis: pattern.axis ?? '', length: pattern.length }
    } else if (pattern.kind === 'streak_bad') {
      state =
        pattern.length === 2 ? 'STREAK_2'
        : pattern.length === 3 ? 'STREAK_3'
        : 'STREAK_LONG'
      vars = { axis: pattern.axis ?? '', length: pattern.length }
    } else if (pattern.kind === 'bounced_back') {
      state = 'BOUNCED_BACK'
      vars = { length: pattern.length }
    } else if (pattern.kind === 'clean_streak') {
      state = 'CLEAN_STREAK'
      vars = { length: pattern.length }
    } else if (pattern.kind === 'first_slip') {
      state = 'FIRST_SLIP'
      vars = {}
    }
  }

  if (!state) {
    if (boxedIn && proteinLeft > 0) {
      state = 'BOXED_IN'
      vars = { caloriesLeft, proteinLeft }
    } else if (protein === 'bad') {
      state = 'PROTEIN_BAD'
    } else if (calories === 'bad') {
      state = 'CALORIES_BAD'
    } else if (fat === 'bad') {
      state = 'FAT_BAD'
    } else if (sugar === 'bad') {
      state = 'SUGAR_BAD'
    } else if (redMealCount >= 2) {
      state = 'JUNK_DAY'
    } else if (protein === 'warn') {
      state = 'PROTEIN_WARN'
    } else if (fat === 'warn') {
      state = 'FAT_WARN'
    } else if (overall === 'good' && consumed.calories > 0) {
      state = 'ON_TRACK'
    }
  }

  const line = state ? pickCoachLine(state, vars) : { headline: '', body: '' }
  const coachLine = line.body ? `${line.headline}. ${line.body}` : ''

  return {
    overall,
    protein,
    fat,
    sugar,
    calories,
    boxedIn,
    consumed,
    coachLine,
    coach: {
      severity: overall,
      headline: line.headline,
      body: line.body,
    },
  }
}
