import { COACH_COPY, type CoachLine } from './coachCopy'

const AXIS_LABEL: Record<string, string> = {
  protein: 'protein',
  fat: 'fat',
  sugar: 'sugar',
  calories: 'your calorie count',
}

const RECENT_KEY = 'disc_coach_recent'
const RECENT_MAX = 40

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    return []
  }
}

function writeRecent(list: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    // ignore quota / private-mode failures
  }
}

function substitute(
  text: string,
  vars: Record<string, string | number>,
): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (!(key in vars)) return `{${key}}`
    const value = vars[key]
    if (key === 'axis' && typeof value === 'string' && value in AXIS_LABEL) {
      return AXIS_LABEL[value]
    }
    return String(value)
  })
}

export function pickCoachLine(
  state: string,
  vars: Record<string, string | number> = {},
): CoachLine {
  const pool = COACH_COPY[state]
  if (!pool || pool.length === 0) {
    return { headline: '', body: '' }
  }

  const recent = readRecent()
  const candidates = pool
    .map((_, i) => i)
    .filter(i => !recent.includes(`${state}:${i}`))
  const indices = candidates.length > 0 ? candidates : pool.map((_, i) => i)

  const index = indices[Math.floor(Math.random() * indices.length)]
  const next = [...recent, `${state}:${index}`].slice(-RECENT_MAX)
  writeRecent(next)

  const line = pool[index]
  return {
    headline: substitute(line.headline, vars),
    body: substitute(line.body, vars),
  }
}
