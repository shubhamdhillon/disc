import { containerMl, containerName, lowestHealthy, type Answers } from './answers'

/* The Plan: daily targets plus the reason behind each one.
   Standard, well-known maths (Mifflin-St Jeor for energy), explained in plain
   words, with safety limits. Not medical advice. */

export interface PlanLine { key: string; label: string; value: string; reason: string }
export interface Plan { lines: PlanLine[]; notes: string[]; calories: number; protein: number; waterMl: number }

const round = (n: number, to: number) => Math.round(n / to) * to
const fmt = (n: number) => n.toLocaleString('en-IN')
const has = (a: Answers, h: Answers['health'][number]) => a.health.includes(h)

/** What the body uses on a usual day. */
export function maintenance(a: Answers): number {
  const sexAdj = a.sex === 'male' ? 5 : a.sex === 'female' ? -161 : -78
  const bmr = 10 * a.weight + 6.25 * a.height - 5 * a.age + sexAdj
  const work = { sitting: 1.2, mix: 1.3, feet: 1.4 }[a.workday ?? 'sitting']
  const walk = { low: 0, some: 0.05, good: 0.1, lots: 0.2 }[a.steps ?? 'low']
  const train = { none: 0, some: 0.05, regular: 0.1, lots: 0.15 }[a.workouts ?? 'none']
  return bmr * Math.min(work + walk + train, 1.9)
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
    key: 'water',
    label: 'Water',
    value: `${count} ${count === 1 ? one : many} a day`,
    reason: `About ${litres} L, counted in what you actually drink from. More on hot days and workout days.`,
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
  let calReason = 'What your body uses on a usual day, so your weight holds steady.'
  if (a.goal === 'lose' && !noCut) {
    calories = Math.max(keep - Math.min(keep * 0.2, 500), floorCalories(a))
    calReason = `About ${fmt(round(keep - calories, 50))} under what you burn. Enough to lose steadily without feeling starved.`
  } else if (a.goal === 'recomp' && !noCut) {
    calories = Math.max(keep - Math.min(keep * 0.1, 300), floorCalories(a))
    calReason = `Just a little under what you burn (about ${fmt(round(keep - calories, 50))}). Enough to lose fat slowly while the protein and lifting build muscle.`
  } else if (a.goal === 'muscle') {
    calories = keep + 250
    calReason = 'A small surplus over what you burn, so the extra goes to muscle, not fat.'
  } else if (a.goal === 'better') {
    calReason = "Right at what you burn. We'll work on what's on the plate before touching the amount."
  }
  if ((a.goal === 'lose' || a.goal === 'recomp') && noCut) {
    calReason = has(a, 'pregnant')
      ? "No cutting while you're pregnant or breastfeeding. We'll hold steady and focus on eating well."
      : has(a, 'eating')
        ? "No cutting for now. Since eating has been hard before, we'll focus on regular, good meals, not on eating less."
        : "No cutting: you're already on the lighter side for your height. Building muscle is the better way to change shape."
  }
  calories = round(calories, 50)

  // Protein is worked out on a healthy reference weight, so it doesn't balloon for bigger bodies
  const refWeight = Math.min(a.weight, 25 * (a.height / 100) ** 2)
  const perKg = has(a, 'kidney') ? 0.8 : { lose: 1.6, recomp: 2.0, muscle: 1.8, steady: 1.2, better: 1.2 }[a.goal ?? 'steady']
  const protein = round(refWeight * perKg, 5)
  const proteinReason = has(a, 'kidney')
    ? 'Kept moderate because of your kidneys. Your doctor may set a different number, go with theirs.'
    : {
        lose: 'It keeps you full and holds on to muscle while you lose fat.',
        recomp: "The key to recomposition. It's what lets you build muscle while eating a little less.",
        muscle: 'Muscle needs it to grow.',
        steady: 'Enough to keep you strong and full.',
        better: 'Enough to keep you strong and full. Most Indian diets fall short here.',
      }[a.goal ?? 'steady']

  const waterMl = Math.min(Math.max(a.weight * 35, 2000), 3500)

  const lifts = a.goal === 'recomp' || a.goal === 'muscle'
  const move: PlanLine = lifts
    ? {
        key: 'move', label: 'Strength', value: '3 days a week',
        reason: a.workoutTypes.includes('weights') || a.workoutTypes.includes('home')
          ? 'Keep training at least 3 times a week, with some weight or resistance each time. Muscle only grows when you give it a reason.'
          : 'Muscle only grows when you give it a reason. Weights or home workouts both count. Full workout plans come in a later update.',
      }
    : {
        key: 'move', label: 'Move', value: `${a.workouts === 'lots' ? 4 : 3} active days a week`,
        reason: a.workouts === 'none' || !a.workouts
          ? "Start small: three 20-minute walks or workouts a week. We'll build from there."
          : a.workouts === 'some' ? 'One more active day than now. Small step, big difference over a month.'
          : "You're already moving well. This keeps it steady.",
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
        key: 'walk', label: 'Walk', value: `${walkPlan.mins} extra minutes a day`,
        reason: `On top of what you walk now. A brisk walk, the treadmill, or pacing on calls all count. If your phone tracks steps, that's about ${fmt(walkPlan.steps)} in the day.`,
      }
    : {
        key: 'walk', label: 'Walk', value: 'Keep it up',
        reason: `You already walk a lot, about ${fmt(walkPlan.steps)} steps or more. Just keep doing what you're doing.`,
      }

  // After a hard time with eating, numbers can do harm: no calorie target, no weigh-ins
  const gentle = has(a, 'eating')
  const lines: PlanLine[] = [
    gentle
      ? { key: 'cal', label: 'Calories', value: 'No number for now', reason: "We'll focus on eating regular, good meals, not on counting. You can add a number later if you ever want one." }
      : { key: 'cal', label: 'Calories', value: `${fmt(calories)} a day`, reason: calReason },
    gentle
      ? { key: 'protein', label: 'Protein', value: 'Some in every meal', reason: 'Dal, paneer, curd, eggs, chicken: a portion with each meal keeps you full and steady. No counting needed.' }
      : { key: 'protein', label: 'Protein', value: `${protein} g a day`, reason: `${perKg} g for every kg of a healthy weight for your height. ${proteinReason}` },
    waterLine(a, waterMl),
    move,
    walk,
    gentle ? {
      key: 'weigh', label: 'Check-in', value: 'Every Monday',
      reason: "A quick \"how are you feeling?\" about food, energy and mood. No scale unless you want one.",
    } : {
      key: 'weigh', label: 'Check-in', value: 'Every Monday morning',
      reason: a.goal === 'recomp'
        ? "Weight barely moves when you recompose, so we'll also track your waist and arms every two weeks. That's where the change shows."
        : 'Weight once a week, same day, before breakfast. One day tells you nothing, a week tells you plenty.',
    },
  ]

  if (has(a, 'diabetes')) notes.push("With diabetes, we'll go easy on sugar and refined carbs in our suggestions.")
  if (has(a, 'bp')) notes.push("For blood pressure, we'll keep an eye on salty food like pickles, namkeen and papad.")
  if (has(a, 'thyroid')) notes.push('With thyroid, weight can move slower. That\'s normal, not failure.')
  if (has(a, 'pcos')) notes.push("With PCOS, protein, fibre and strength training help the most. We'll lean that way.")
  if (a.health.some(h => h !== 'none')) notes.push('These are starting points, not medical advice. Run them by your doctor, and change anything whenever you need.')

  return { lines, notes, calories, protein, waterMl }
}

const dayName: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }

function ownPlan(a: Answers): Plan {
  const c = a.container ?? 'glass'
  const waterMl = a.myWater * containerMl[c]
  const [one, many] = containerName[c]
  const lines: PlanLine[] = [
    { key: 'cal', label: 'Calories', value: `${fmt(a.myCalories)} a day`, reason: '' },
    { key: 'protein', label: 'Protein', value: `${a.myProtein} g a day`, reason: '' },
    { key: 'water', label: 'Water', value: `${a.myWater} ${a.myWater === 1 ? one : many} a day`, reason: `About ${(waterMl / 1000).toFixed(1).replace('.0', '')} L.` },
    { key: 'move', label: 'Workouts', value: a.myWorkoutDays ? `${a.myWorkoutDays} days a week` : 'Not planned yet', reason: '' },
    { key: 'weigh', label: 'Check-in', value: `Every ${dayName[a.weighIn ?? 'mon']} morning`, reason: a.goal === 'recomp' ? 'Plus waist and arms every two weeks, since the scale barely moves in a recomposition.' : 'Weight once a week, before breakfast.' },
  ]
  const notes: string[] = []
  if (has(a, 'kidney') && a.myProtein > a.weight * 1.0) notes.push("That protein is on the high side with a kidney condition. Please check it with your doctor.")
  if (a.health.some(h => h !== 'none')) notes.push('You mentioned a health condition. Worth running these numbers by your doctor.')
  return { lines, notes, calories: a.myCalories, protein: a.myProtein, waterMl }
}
