import type { Targets } from './targetsStore'
import type { LoggedMeal } from './mealsStore'
import type { DayPattern } from './dayPattern'

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

type IssueKey = 'protein' | 'fat' | 'sugar' | 'calories' | 'junk'
type Issue = { key: IssueKey; severity: 'warn' | 'bad' }

function singleIssueHeadline(issue: Issue): string {
  switch (issue.key) {
    case 'protein':
      return issue.severity === 'bad' ? 'Protein came up short' : 'Watch the protein'
    case 'fat':
      return issue.severity === 'bad' ? 'Over on fat' : 'Watch the fat'
    case 'sugar':
      return issue.severity === 'bad' ? 'Over on sugar' : 'Watch the sugar'
    case 'calories':
      return issue.severity === 'bad' ? 'Over on calories' : 'Watch the calories'
    case 'junk':
      return issue.severity === 'bad' ? 'Too much junk' : 'Watch the junk'
  }
}

function proteinSentence(
  severity: 'warn' | 'bad',
  boxedIn: boolean,
  caloriesLeft: number,
  proteinLeft: number,
): string {
  if (severity === 'bad' && boxedIn) {
    return `Protein's well short, and you've spent most of your calories already. There's about ${caloriesLeft} left and you still need ${proteinLeft}g, so keep whatever's next lean.`
  }
  if (severity === 'bad') {
    return `Protein's well short for the day. You've got ${caloriesLeft} calories left, so make them count: eggs, dal, paneer, chicken.`
  }
  return `Protein's a bit short. You've got ${caloriesLeft} calories left, so make them count.`
}

function issuePrimarySentence(
  issue: Issue,
  boxedIn: boolean,
  caloriesLeft: number,
  proteinLeft: number,
): string {
  switch (issue.key) {
    case 'protein':
      return proteinSentence(issue.severity, boxedIn, caloriesLeft, proteinLeft)
    case 'fat':
      return issue.severity === 'bad'
        ? `You're over on fat. Nothing to undo now, keep the rest of the day lean.`
        : `You're close to your fat limit. Watch it on the next meal.`
    case 'sugar':
      return issue.severity === 'bad'
        ? `Sugar's over for the day.`
        : `You're close to your sugar limit.`
    case 'calories':
      return issue.severity === 'bad'
        ? `You're over your calories for today.`
        : `You're close to your calorie limit.`
    case 'junk':
      return issue.severity === 'bad'
        ? `Too much junk crept in today.`
        : `Some junk crept in today.`
  }
}

/** Short follow-on clause when this issue isn't the lead. */
function issueFollowOn(issue: Issue): string {
  switch (issue.key) {
    case 'protein':
      return issue.severity === 'bad'
        ? `protein's well short too`
        : `protein's a bit short too`
    case 'fat':
      return issue.severity === 'bad'
        ? `you're over on fat too`
        : `you're close to your fat limit`
    case 'sugar':
      return issue.severity === 'bad'
        ? `sugar's over too`
        : `sugar's getting close`
    case 'calories':
      return issue.severity === 'bad'
        ? `you're over your calories too`
        : `calories are getting close`
    case 'junk':
      return issue.severity === 'bad'
        ? `too much junk crept in too`
        : `some junk crept in`
  }
}

function composeCoachBody(
  issues: Issue[],
  boxedIn: boolean,
  caloriesLeft: number,
  proteinLeft: number,
): string {
  if (issues.length === 0) {
    return `Nothing off so far. Keep it going.`
  }

  if (issues.length === 1) {
    return issuePrimarySentence(issues[0], boxedIn, caloriesLeft, proteinLeft)
  }

  // Protein leads when present; remaining issues become natural follow-ons.
  const lead = issues[0]
  const rest = issues.slice(1)
  const primary = issuePrimarySentence(lead, boxedIn, caloriesLeft, proteinLeft)

  if (rest.length === 1) {
    const follow = issueFollowOn(rest[0])
    // Capitalize only when starting a new sentence after a period.
    if (primary.endsWith('.')) {
      return `${primary} ${follow.charAt(0).toUpperCase()}${follow.slice(1)}.`
    }
    return `${primary} ${follow}.`
  }

  // 3+: join follow-ons with commas and "and"
  const follows = rest.map(issueFollowOn)
  const last = follows[follows.length - 1]
  const head = follows.slice(0, -1).join(', ')
  const joined = `${head}, and ${last}`
  if (primary.endsWith('.')) {
    return `${primary} ${joined.charAt(0).toUpperCase()}${joined.slice(1)}.`
  }
  return `${primary} ${joined}.`
}

function axisTitle(axis: NonNullable<DayPattern['axis']>): string {
  return axis.charAt(0).toUpperCase() + axis.slice(1)
}

/** Pattern-aware headline/body when the multi-day story matters more than today alone. */
function patternCoachCopy(
  pattern: DayPattern,
  plainHeadline: string,
  plainBody: string,
): { headline: string; body: string } | null {
  if (pattern.kind === 'steady') return null

  switch (pattern.kind) {
    case 'chronic': {
      const axis = pattern.axis
      const n = pattern.length
      if (!axis) return null
      if (axis === 'protein') {
        return {
          headline: 'This again',
          body: `Protein's been short ${n} of the last 7 days. That's not a slip anymore, that's the pattern. Fix the next meal.`,
        }
      }
      if (axis === 'fat') {
        return {
          headline: 'Fat, again',
          body: `That's ${n} days out of 7 over on fat. Something in the routine needs to change.`,
        }
      }
      if (axis === 'sugar') {
        return {
          headline: 'Sugar, again',
          body: `That's ${n} days out of 7 over on sugar. Something in the routine needs to change.`,
        }
      }
      return {
        headline: 'Calories, again',
        body: `That's ${n} days out of 7 over on calories. Something in the routine needs to change.`,
      }
    }

    case 'streak_bad': {
      const axis = pattern.axis
      if (!axis) return null
      const name = axisTitle(axis)
      const n = pattern.length
      if (pattern.intensity === 1) {
        return {
          headline: 'Twice now',
          body: `${name} was off yesterday too. Worth catching before it becomes a thing.`,
        }
      }
      if (pattern.intensity === 2) {
        return {
          headline: 'Three in a row',
          body: `Third day running on ${axis}. What's going on?`,
        }
      }
      return {
        headline: `${n} days straight`,
        body: `${name} has been off ${n} days running. This needs a real fix, not a better tomorrow.`,
      }
    }

    case 'first_slip':
      return {
        headline: plainHeadline,
        body: `${plainBody} First off day in a while, so no drama. Just don't make it two.`,
      }

    case 'bounced_back':
      return {
        headline: 'Back on it',
        body: `Clean day after ${pattern.length} rough ones. That's the harder one to do.`,
      }

    case 'clean_streak':
      return {
        headline: `${pattern.length} clean`,
        body: `${pattern.length} days straight. Keep it boring.`,
      }

    default:
      return null
  }
}

function buildCoach(
  overall: DayVerdict['overall'],
  protein: AxisStatus,
  fat: AxisStatus,
  sugar: AxisStatus,
  calories: AxisStatus,
  redMealCount: number,
  boxedIn: boolean,
  caloriesLeft: number,
  proteinLeft: number,
  pattern?: DayPattern,
): DayVerdict['coach'] {
  // Collect true issues in priority order: protein, fat, sugar, calories, junk
  const issues: Issue[] = []
  if (protein === 'warn' || protein === 'bad') {
    issues.push({ key: 'protein', severity: protein })
  }
  if (fat === 'warn' || fat === 'bad') {
    issues.push({ key: 'fat', severity: fat })
  }
  if (sugar === 'warn' || sugar === 'bad') {
    issues.push({ key: 'sugar', severity: sugar })
  }
  if (calories === 'warn' || calories === 'bad') {
    issues.push({ key: 'calories', severity: calories })
  }
  if (redMealCount >= 2) {
    issues.push({ key: 'junk', severity: 'bad' })
  } else if (redMealCount === 1) {
    issues.push({ key: 'junk', severity: 'warn' })
  }

  let headline: string
  if (issues.length === 0) {
    headline = 'On track'
  } else if (issues.length >= 3) {
    headline = 'A few things off today'
  } else if (issues.length === 2) {
    headline = 'Two things off today'
  } else {
    headline = singleIssueHeadline(issues[0])
  }

  const body = composeCoachBody(issues, boxedIn, caloriesLeft, proteinLeft)

  if (pattern) {
    const patterned = patternCoachCopy(pattern, headline, body)
    if (patterned) {
      return { severity: overall, headline: patterned.headline, body: patterned.body }
    }
  }

  return {
    severity: overall,
    headline,
    body,
  }
}

/**
 * Pure coach brain: judge a day from meals, targets, and current time.
 * Optional pattern escalates coach copy across days. No I/O.
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

  const coach = buildCoach(
    overall,
    protein,
    fat,
    sugar,
    calories,
    redMealCount,
    boxedIn,
    caloriesLeft,
    proteinLeft,
    pattern,
  )

  return {
    overall,
    protein,
    fat,
    sugar,
    calories,
    boxedIn,
    consumed,
    coachLine,
    coach,
  }
}
