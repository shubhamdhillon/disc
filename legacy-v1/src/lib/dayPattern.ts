import type { DailyRecord } from './dailyRecords'

export type PatternKind =
  | 'first_slip'        // today is bad/warn after a run of good days
  | 'streak_bad'        // 2+ consecutive days ending today with the same failing axis
  | 'chronic'           // same axis failing on 4+ of the last 7 days
  | 'bounced_back'      // today is good after 2+ bad days
  | 'clean_streak'      // 3+ consecutive good days ending today
  | 'steady'            // nothing notable

export interface DayPattern {
  kind: PatternKind
  /** For streaks and chronic: which axis is the repeat offender. */
  axis: 'protein' | 'fat' | 'sugar' | 'calories' | null
  /** How many days the pattern has run. 0 when not applicable. */
  length: number
  /** Days with meals logged in the window, for confidence. */
  daysLogged: number
  /** How hard the coach should push. 0 = barely mention, 3 = confront. */
  intensity: 0 | 1 | 2 | 3
}

type AxisKey = 'protein' | 'fat' | 'sugar' | 'calories'

/** Tie-break / priority when multiple axes qualify. */
const AXIS_PRIORITY: AxisKey[] = ['protein', 'fat', 'sugar', 'calories']

function steady(daysLogged: number): DayPattern {
  return { kind: 'steady', axis: null, length: 0, daysLogged, intensity: 0 }
}

/** Logged days only — unlogged days are absent, not good. */
function loggedDays(recent: DailyRecord[]): DailyRecord[] {
  return recent.filter(d => d.mealCount > 0 && d.axes !== null && d.verdict !== null)
}

function streakIntensity(length: number): 1 | 2 | 3 {
  if (length >= 4) return 3
  if (length === 3) return 2
  return 1
}

/** Prefer bad over warn; within that, AXIS_PRIORITY. */
function worstFailingAxis(axes: NonNullable<DailyRecord['axes']>): AxisKey | null {
  for (const status of ['bad', 'warn'] as const) {
    for (const axis of AXIS_PRIORITY) {
      if (axes[axis] === status) return axis
    }
  }
  return null
}

function badRunLength(logged: DailyRecord[], axis: AxisKey): number {
  let length = 0
  for (let i = logged.length - 1; i >= 0; i--) {
    const axes = logged[i].axes
    if (!axes || axes[axis] !== 'bad') break
    length += 1
  }
  return length
}

/**
 * Read recent daily records (oldest → today) and identify a cross-day pattern.
 * Pure — no I/O.
 */
export function computeDayPattern(recent: DailyRecord[]): DayPattern {
  const logged = loggedDays(recent)
  const daysLogged = logged.length

  // 1. Not enough evidence
  if (daysLogged < 2) {
    return steady(daysLogged)
  }

  // 2. CHRONIC — same axis 'bad' on 4+ logged days in the window
  const badCounts: Record<AxisKey, number> = {
    protein: 0,
    fat: 0,
    sugar: 0,
    calories: 0,
  }
  for (const day of logged) {
    const axes = day.axes!
    for (const axis of AXIS_PRIORITY) {
      if (axes[axis] === 'bad') badCounts[axis] += 1
    }
  }

  let chronicAxis: AxisKey | null = null
  let chronicCount = 0
  for (const axis of AXIS_PRIORITY) {
    const count = badCounts[axis]
    if (count >= 4 && count > chronicCount) {
      chronicAxis = axis
      chronicCount = count
    }
  }
  if (chronicAxis) {
    return {
      kind: 'chronic',
      axis: chronicAxis,
      length: chronicCount,
      daysLogged,
      intensity: 3,
    }
  }

  const today = logged[logged.length - 1]
  const todayAxes = today.axes!

  // 3. STREAK_BAD — same axis 'bad' on today + 1+ prior consecutive logged days
  let streakAxis: AxisKey | null = null
  let streakLen = 0
  for (const axis of AXIS_PRIORITY) {
    if (todayAxes[axis] !== 'bad') continue
    const len = badRunLength(logged, axis)
    if (len >= 2 && len > streakLen) {
      streakAxis = axis
      streakLen = len
    }
  }
  if (streakAxis) {
    return {
      kind: 'streak_bad',
      axis: streakAxis,
      length: streakLen,
      daysLogged,
      intensity: streakIntensity(streakLen),
    }
  }

  // 4. BOUNCED_BACK — today good after 2+ consecutive bad logged days
  if (today.verdict === 'good') {
    let badRun = 0
    for (let i = logged.length - 2; i >= 0; i--) {
      if (logged[i].verdict !== 'bad') break
      badRun += 1
    }
    if (badRun >= 2) {
      return {
        kind: 'bounced_back',
        axis: null,
        length: badRun,
        daysLogged,
        intensity: 0,
      }
    }
  }

  // 5. CLEAN_STREAK — today + 2+ prior consecutive logged days all good
  if (today.verdict === 'good') {
    let goodRun = 1
    for (let i = logged.length - 2; i >= 0; i--) {
      if (logged[i].verdict !== 'good') break
      goodRun += 1
    }
    if (goodRun >= 3) {
      return {
        kind: 'clean_streak',
        axis: null,
        length: goodRun,
        daysLogged,
        intensity: 0,
      }
    }
  }

  // 6. FIRST_SLIP — today bad/warn after a good logged day
  if (today.verdict === 'bad' || today.verdict === 'warn') {
    const prev = logged[logged.length - 2]
    if (prev.verdict === 'good') {
      return {
        kind: 'first_slip',
        axis: worstFailingAxis(todayAxes),
        length: 1,
        daysLogged,
        intensity: 0,
      }
    }
  }

  // 7. Otherwise steady
  return steady(daysLogged)
}
