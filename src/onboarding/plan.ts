import { containerMl, containerName, type Answers } from './answers'

/* The Plan: daily targets plus the reason behind each one.
   Plain maths, explained in plain words. Not medical advice. */

export interface PlanLine { key: string; label: string; value: string; reason: string }
export interface Plan { lines: PlanLine[]; note?: string; calories: number; protein: number; waterMl: number }

const round = (n: number, to: number) => Math.round(n / to) * to
const fmt = (n: number) => n.toLocaleString('en-IN')

function maintenance(a: Answers): number {
  const s = a.sex === 'female' ? -161 : 5
  const bmr = 10 * a.weight + 6.25 * a.height - 5 * a.age + s
  const base = { sitting: 1.2, mix: 1.35, feet: 1.5 }[a.workday ?? 'sitting']
  const extra = { barely: 0, walks: 0.05, some: 0.1, often: 0.2 }[a.movement ?? 'barely']
  return bmr * Math.min(base + extra, 1.9)
}

export function floorCalories(a: Answers): number {
  return a.sex === 'female' ? 1200 : 1500
}

/** Honest range in weeks to reach the target weight, or null when there isn't one. */
export function weeksRange(a: Answers): [number, number] | null {
  if (a.target === undefined || (a.goal !== 'lose' && a.goal !== 'muscle')) return null
  const diff = Math.abs(a.weight - a.target)
  if (diff < 0.5) return null
  // Losing: 0.25 to 0.5 kg a week. Gaining lean weight: 0.15 to 0.25 kg a week.
  const [fast, slow] = a.goal === 'lose' ? [0.5, 0.25] : [0.25, 0.15]
  return [Math.ceil(diff / fast), Math.ceil(diff / slow)]
}

function waterLine(a: Answers, ml: number): PlanLine {
  const c = a.container ?? 'glass'
  const count = Math.max(1, Math.round(ml / containerMl[c]))
  const [one, many] = containerName[c]
  return {
    key: 'water',
    label: 'Water',
    value: `${count} ${count === 1 ? one : many} a day`,
    reason: `About ${(count * containerMl[c] / 1000).toFixed(1).replace('.0', '')} L. Roughly 35 ml for every kg you weigh, counted in what you actually drink from.`,
  }
}

const caution = (a: Answers) => a.health.some(h => h !== 'none')

export function buildPlan(a: Answers): Plan {
  if (a.path === 'own') return ownPlan(a)

  const keep = maintenance(a)
  const pregnant = a.health.includes('pregnant')
  let calories = keep
  let calReason = 'What your body uses on a normal day, so your weight holds steady.'
  if (a.goal === 'lose' && !pregnant) {
    const cut = Math.min(keep * 0.2, 500)
    calories = Math.max(keep - cut, floorCalories(a))
    calReason = `About ${fmt(round(keep - calories, 50))} under what you burn. Enough to lose steadily without feeling starved.`
  } else if (a.goal === 'muscle') {
    calories = keep + 250
    calReason = 'A small surplus over what you burn, so the extra goes to muscle, not fat.'
  } else if (a.goal === 'better') {
    calReason = "Right at what you burn. We'll work on what's on the plate before touching the amount."
  }
  if (a.goal === 'lose' && pregnant) {
    calReason = "No cutting while you're pregnant or feeding. We'll hold steady and focus on eating well."
  }
  calories = round(calories, 50)

  const perKg = { lose: 1.6, muscle: 1.8, steady: 1.2, better: 1.2 }[a.goal ?? 'steady']
  const protein = round(a.weight * perKg, 5)
  const proteinReason = a.goal === 'lose'
    ? `${perKg} g for every kg you weigh. It keeps you full and holds on to muscle while you lose fat.`
    : a.goal === 'muscle'
      ? `${perKg} g for every kg you weigh. Muscle needs it to grow.`
      : `${perKg} g for every kg you weigh. Enough to keep you strong and full.`

  const waterMl = a.weight * 35

  const activeDays = a.movement === 'often' ? 4 : 3
  const moveReason = {
    barely: "Start small: three 20-minute walks a week. We'll build from there.",
    walks: 'Turn the walks you already do into three proper ones a week.',
    some: 'One more active day than now. Small step, big difference over a month.',
    often: "You're already moving well. Four days keeps it steady.",
  }[a.movement ?? 'barely']

  const lines: PlanLine[] = [
    { key: 'cal', label: 'Calories', value: `${fmt(calories)} a day`, reason: calReason },
    { key: 'protein', label: 'Protein', value: `${protein} g a day`, reason: proteinReason },
    waterLine(a, waterMl),
    { key: 'move', label: 'Move', value: `${activeDays} active days a week`, reason: moveReason },
    { key: 'weigh', label: 'Check-in', value: 'Every Monday morning', reason: 'Weight once a week, same day, before breakfast. One day tells you nothing, a week tells you plenty.' },
  ]
  return {
    lines,
    calories,
    protein,
    waterMl,
    note: caution(a) ? "You mentioned a health condition, so these are gentle starting points. Run them by your doctor, and we'll adjust whenever you need." : undefined,
  }
}

const dayName: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }

function ownPlan(a: Answers): Plan {
  const c = a.container ?? 'glass'
  const waterMl = a.myWater * containerMl[c]
  const [one, many] = containerName[c]
  const lines: PlanLine[] = [
    { key: 'cal', label: 'Calories', value: `${fmt(a.myCalories)} a day`, reason: 'Your number.' },
    { key: 'protein', label: 'Protein', value: `${a.myProtein} g a day`, reason: 'Your number.' },
    { key: 'water', label: 'Water', value: `${a.myWater} ${a.myWater === 1 ? one : many} a day`, reason: `About ${(waterMl / 1000).toFixed(1).replace('.0', '')} L.` },
    { key: 'move', label: 'Workouts', value: a.myWorkoutDays ? `${a.myWorkoutDays} days a week` : 'Not planned yet', reason: 'Your number.' },
    { key: 'weigh', label: 'Check-in', value: `Every ${dayName[a.weighIn ?? 'mon']} morning`, reason: 'Weight once a week, before breakfast.' },
  ]
  return {
    lines,
    calories: a.myCalories,
    protein: a.myProtein,
    waterMl,
    note: caution(a) ? 'You mentioned a health condition. Worth running these numbers by your doctor.' : undefined,
  }
}
