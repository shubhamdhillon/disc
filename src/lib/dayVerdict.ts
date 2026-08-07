import type { Targets } from './targetsStore'
import type { LoggedMeal } from './mealsStore'

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
}

/** Placeholder daily sugar ceiling (g) until targets include sugar. Revisit. */
const SUGAR_CEILING = 40

function axisCeiling(pct: number): AxisStatus {
  if (pct > 1.0) return 'bad'
  if (pct >= 0.8) return 'warn'
  return 'fine'
}

/**
 * Pure coach brain: judge a day from meals, targets, and current time.
 * No I/O — outputs axis status + overall verdict for the UI to interpret.
 */
export function computeDayVerdict(
  meals: LoggedMeal[],
  targets: Targets,
  now: Date,
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
    // Don't scold early, but surface if badly behind pace
    protein = pctProtein < 0.4 ? 'warn' : 'fine'
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

  // COACH LINE — first matching priority wins
  let coachLine = ''
  if (boxedIn && proteinLeft > 0) {
    coachLine = `Tight on protein — you've got ${caloriesLeft} cal left but still need ${proteinLeft}g protein. Keep the rest lean and high-protein.`
  } else if (fat === 'bad') {
    coachLine = `You're over on fat for the day. Keep the rest lean.`
  } else if (calories === 'bad') {
    coachLine = `You're over your calories for today.`
  } else if (late && protein === 'bad') {
    coachLine = `You're well short on protein today — you needed ${proteinLeft}g more.`
  } else if (fat === 'warn') {
    coachLine = `Watch the fat — you're close to your limit for the day.`
  } else if (redMealCount >= 2) {
    coachLine = `Too much junk crept in today.`
  } else if (late && protein === 'warn') {
    coachLine = `A bit short on protein — try to close the gap.`
  } else if (overall === 'good' && consumed.calories > 0) {
    coachLine = `On track — nice work so far.`
  }
  // else: empty (no meals yet, or nothing to say)

  return {
    overall,
    protein,
    fat,
    sugar,
    calories,
    boxedIn,
    consumed,
    coachLine,
  }
}
