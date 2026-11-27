import { containerMl, containerName, lowestHealthy, type Answers } from './answers'

/* The Plan: daily targets plus the reason behind each one.
   Standard, well-known maths (Mifflin-St Jeor for energy), explained in plain
   words, with safety limits. Not medical advice. */

/** group: 'hero' is the one big number; 'day' and 'week' split the rest into a routine. */
export interface PlanLine { key: string; label: string; value: string; reason: string; group: 'hero' | 'day' | 'week' }
export interface Plan { lines: PlanLine[]; notes: string[]; calories: number; protein: number; waterMl: number }

const round = (n: number, to: number) => Math.round(n / to) * to
const fmt = (n: number) => n.toLocaleString('en-IN')
const has = (a: Answers, h: Answers['health'][number]) => a.health.includes(h)

/** What the body uses on a usual day. */
function bmr(a: Answers): number {
  const sexAdj = a.sex === 'male' ? 5 : a.sex === 'female' ? -161 : -78
  return 10 * a.weight + 6.25 * a.height - 5 * a.age + sexAdj
}

export function maintenance(a: Answers): number {
  const work = { sitting: 1.2, mix: 1.3, feet: 1.4 }[a.workday ?? 'sitting']
  const walk = { low: 0, some: 0.05, good: 0.1, lots: 0.2 }[a.steps ?? 'low']
  const train = { none: 0, some: 0.05, regular: 0.1, lots: 0.15 }[a.workouts ?? 'none']
  return bmr(a) * Math.min(work + walk + train, 1.9)
}

/** Setup screens whose answer changes what you burn. */
export type BurnStep = 'body' | 'workday' | 'steps' | 'workouts'

/** What you burn a day counting only the answers up to this screen, and how much
    this screen's answer added. Rounded to 50, like the plan. */
export function burnSoFar(a: Answers, step: BurnStep): { now: number; delta: number } {
  const order: BurnStep[] = ['body', 'workday', 'steps', 'workouts']
  const upTo = order.indexOf(step)
  const factor = (x: Answers, n: number) =>
    (n >= 1 && x.workday ? { sitting: 1.2, mix: 1.3, feet: 1.4 }[x.workday] : 1)
    + (n >= 2 && x.steps ? { low: 0, some: 0.05, good: 0.1, lots: 0.2 }[x.steps] : 0)
    + (n >= 3 && x.workouts ? { none: 0, some: 0.05, regular: 0.1, lots: 0.15 }[x.workouts] : 0)
  const at = (n: number) => round(bmr(a) * Math.min(factor(a, n), 1.9), 50)
  const now = at(upTo)
  return { now, delta: upTo === 0 ? 0 : now - at(upTo - 1) }
}

export function floorCalories(a: Answers): number {
  return a.sex === 'male' ? 1500 : 1200
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
  const litres = (count * containerMl[c] / 1000).toFixed(1).replace('.0', '')
  return {
    key: 'water', group: 'day',
    label: 'Water',
    value: `${count} ${count === 1 ? one : many}`,
    reason: `About ${litres} L. A little more on hot days and workout days.`,
  }
}

export function buildPlan(a: Answers): Plan {
  if (a.path === 'own') return ownPlan(a)

  const notes: string[] = []
  const keep = maintenance(a)
  const lean = a.weight - lowestHealthy(a.height) < 1
  // No cutting at all for these, whatever the goal
  const noCut = has(a, 'pregnant') || has(a, 'eating') || lean

  let calories = keep
  let calReason = 'What your body uses on a usual day, so weight holds.'
  if (a.goal === 'lose' && !noCut) {
    calories = Math.max(keep - Math.min(keep * 0.2, 500), floorCalories(a))
    calReason = `About ${fmt(round(keep - calories, 50))} under what you burn, so you lose without feeling starved.`
  } else if (a.goal === 'recomp' && !noCut) {
    calories = Math.max(keep - Math.min(keep * 0.1, 300), floorCalories(a))
    calReason = `About ${fmt(round(keep - calories, 50))} under what you burn, so fat goes slowly while you build muscle.`
  } else if (a.goal === 'muscle') {
    calories = keep + 250
    calReason = 'About 250 over what you burn, so the extra can build muscle.'
  } else if (a.goal === 'better') {
    calReason = "Right at what you burn. We'll work on what's on the plate first."
  }
  if ((a.goal === 'lose' || a.goal === 'recomp') && noCut) {
    calReason = has(a, 'pregnant')
      ? "No cutting while you're pregnant or breastfeeding. We'll focus on eating well."
      : has(a, 'eating')
        ? "No cutting for now. Regular, good meals come first."
        : "No cutting, since you're already light for your height. Building muscle will change your shape."
  }
  calories = round(calories, 50)

  // Protein is worked out on a healthy reference weight, so it doesn't balloon for bigger bodies
  const refWeight = Math.min(a.weight, 25 * (a.height / 100) ** 2)
  const perKg = has(a, 'kidney') ? 0.8 : { lose: 1.6, recomp: 2.0, muscle: 1.8, steady: 1.2, better: 1.2 }[a.goal ?? 'steady']
  const protein = round(refWeight * perKg, 5)
  const proteinReason = has(a, 'kidney')
    ? "Kept moderate for your kidneys. If your doctor gives a number, use theirs."
    : {
        lose: 'Keeps you full and holds on to muscle while you lose fat.',
        recomp: 'Builds muscle while you eat a little less.',
        muscle: 'What your muscles need to grow.',
        steady: 'Keeps you strong and full.',
        better: 'Keeps you strong and full. Most Indian meals fall short here.',
      }[a.goal ?? 'steady']

  const waterMl = Math.min(Math.max(a.weight * 35, 2000), 3500)

  const lifts = a.goal === 'recomp' || a.goal === 'muscle'
  const move: PlanLine = lifts
    ? {
        key: 'move', group: 'week', label: 'Strength', value: '3 days',
        reason: a.workoutTypes.includes('weights') || a.workoutTypes.includes('home')
          ? 'Some weight or resistance each time.'
          : 'Weights or home workouts both count. Full workout plans come later.',
      }
    : {
        key: 'move', group: 'week', label: 'Move', value: `${a.workouts === 'lots' ? 4 : 3} days`,
        reason: a.workouts === 'none' || !a.workouts
          ? 'Start with a 20-minute walk or workout each time.'
          : a.workouts === 'some' ? 'One more than you do now.'
          : "You already move well. This keeps it going.",
      }
  // Minutes first: not everyone carries a phone while walking. About 100 steps a minute.
  const walkPlan = {
    low: { mins: 25, steps: 5000 },
    some: { mins: 20, steps: 7000 },
    good: { mins: 15, steps: 9000 },
    lots: { mins: 0, steps: 10000 },
  }[a.steps ?? 'low']
  const walk: PlanLine = walkPlan.mins
    ? {
        key: 'walk', group: 'day', label: 'Walk', value: `${walkPlan.mins} extra minutes`,
        reason: `On top of what you walk now, about ${fmt(walkPlan.steps)} steps in all. The treadmill counts.`,
      }
    : {
        key: 'walk', group: 'day', label: 'Walk', value: 'Keep it up',
        reason: `You already walk ${fmt(walkPlan.steps)} steps or more.`,
      }

  // After a hard time with eating, numbers can do harm: no calorie target, no weigh-ins
  const gentle = has(a, 'eating')
  const lines: PlanLine[] = [
    gentle
      ? { key: 'cal', group: 'day', label: 'Calories', value: 'No number for now', reason: 'Regular, good meals first. You can add a number anytime.' }
      : { key: 'cal', group: 'hero', label: 'Calories', value: fmt(calories), reason: calReason },
    gentle
      ? { key: 'protein', group: 'day', label: 'Protein', value: 'Some in every meal', reason: 'Dal, paneer, curd, eggs or chicken with each meal. No counting.' }
      : { key: 'protein', group: 'day', label: 'Protein', value: `${protein} g`, reason: `${proteinReason} (${perKg} g per kg of a healthy weight)` },
    waterLine(a, waterMl),
    walk,
    move,
    gentle ? {
      key: 'weigh', group: 'week', label: 'Check-in', value: 'Monday',
      reason: 'How food, energy and mood feel. No scale unless you want one.',
    } : {
      key: 'weigh', group: 'week', label: 'Check-in', value: 'Monday morning',
      reason: a.goal === 'recomp'
        ? 'Weight, plus waist and arms every two weeks, since the scale barely moves.'
        : 'Weight before breakfast, once a week.',
    },
  ]

  if (has(a, 'diabetes')) notes.push("With diabetes, we'll go easy on sugar and refined carbs in our suggestions.")
  if (has(a, 'bp')) notes.push("For blood pressure, we'll keep an eye on salty food like pickles, namkeen and papad.")
  if (has(a, 'thyroid')) notes.push('With thyroid, weight can move slower. That\'s normal.')
  if (has(a, 'pcos')) notes.push("With PCOS, protein, fibre and strength training help the most. We'll lean that way.")
  if (a.health.some(h => h !== 'none')) notes.push('These are starting points, not medical advice. Check them with your doctor.')

  return { lines, notes, calories, protein, waterMl }
}

const dayName: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }

function ownPlan(a: Answers): Plan {
  const c = a.container ?? 'glass'
  const waterMl = a.myWater * containerMl[c]
  const [one, many] = containerName[c]
  const lines: PlanLine[] = [
    { key: 'cal', group: 'hero', label: 'Calories', value: fmt(a.myCalories), reason: '' },
    { key: 'protein', group: 'day', label: 'Protein', value: `${a.myProtein} g`, reason: '' },
    { key: 'water', group: 'day', label: 'Water', value: `${a.myWater} ${a.myWater === 1 ? one : many}`, reason: `About ${(waterMl / 1000).toFixed(1).replace('.0', '')} L.` },
    { key: 'move', group: 'week', label: 'Workouts', value: a.myWorkoutDays ? `${a.myWorkoutDays} days` : 'Not planned yet', reason: '' },
    { key: 'weigh', group: 'week', label: 'Check-in', value: `${dayName[a.weighIn ?? 'mon']} morning`, reason: a.goal === 'recomp' ? 'Weight, plus waist and arms every two weeks, since the scale barely moves.' : 'Weight before breakfast, once a week.' },
  ]
  const notes: string[] = []
  if (has(a, 'kidney') && a.myProtein > a.weight * 1.0) notes.push("That protein is on the high side with a kidney condition. Please check it with your doctor.")
  if (a.health.some(h => h !== 'none')) notes.push('You mentioned a health condition. Worth running these numbers by your doctor.')
  return { lines, notes, calories: a.myCalories, protein: a.myProtein, waterMl }
}
