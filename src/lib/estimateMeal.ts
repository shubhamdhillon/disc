/**
 * estimateMeal.ts
 *
 * Placeholder estimator — returns mock nutritional data after a simulated delay.
 * Replace the body of `estimateMeal` with a real AI API call when ready.
 * The function signature and return type must not change so the sheet wires up
 * with zero modifications.
 */

export interface MealEstimate {
  name:     string
  calories: number
  protein:  number   // grams
  carbs:    number   // grams
  fat:      number   // grams
}

// Simple keyword-based mock so the estimate feels responsive even before
// real AI is wired up. Indian meals only — this app is India-first.
// Macro splits are approximate; real AI will be far more accurate.
const PATTERNS: Array<{ keywords: string[]; result: MealEstimate }> = [
  {
    keywords: ['paneer'],
    result:   { name: 'Paneer curry + roti', calories: 680, protein: 28, carbs: 78, fat: 28 },
  },
  {
    keywords: ['biryani'],
    result:   { name: 'Veg biryani (1 plate)', calories: 560, protein: 14, carbs: 82, fat: 20 },
  },
  {
    keywords: ['idli', 'dosa', 'vada', 'sambhar', 'sambar'],
    result:   { name: 'South Indian breakfast', calories: 380, protein: 12, carbs: 58, fat: 11 },
  },
  {
    keywords: ['chole', 'chhole', 'bhature', 'puri'],
    result:   { name: 'Chole bhature', calories: 720, protein: 18, carbs: 89, fat: 32 },
  },
  {
    keywords: ['poha', 'upma'],
    result:   { name: 'Poha / upma', calories: 310, protein: 8, carbs: 45, fat: 11 },
  },
  {
    keywords: ['paratha', 'parata'],
    result:   { name: 'Aloo paratha (2)', calories: 490, protein: 12, carbs: 61, fat: 22 },
  },
  {
    keywords: ['rice', 'chawal', 'dal', 'sabzi', 'roti'],
    result:   { name: 'Dal, roti, sabzi', calories: 640, protein: 22, carbs: 83, fat: 25 },
  },
]

const DEFAULT_ESTIMATE: MealEstimate = {
  name:     'Dal, roti, sabzi',
  calories: 640,
  protein:  22,
  carbs:    83,
  fat:      25,
}

/**
 * Estimate nutritional values for a free-text meal description.
 * Currently returns mock data after a 1.5 s simulated delay.
 * Swap for a real AI call by replacing the function body.
 */
export async function estimateMeal(input: string): Promise<MealEstimate> {
  // Simulate network / model latency
  await new Promise<void>(res => setTimeout(res, 1500))

  const lower = input.toLowerCase()
  const match = PATTERNS.find(p => p.keywords.some(k => lower.includes(k)))
  return match ? match.result : DEFAULT_ESTIMATE
}
