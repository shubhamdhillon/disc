/*
  Setup answers. Kept on the phone (localStorage) while the user answers,
  so closing the app mid-way loses nothing. Saved to the account after sign-up.
*/

export type Path = 'build' | 'own'
export type Goal = 'lose' | 'muscle' | 'steady' | 'better'
export type Sex = 'male' | 'female'
export type Workday = 'sitting' | 'mix' | 'feet'
export type Movement = 'barely' | 'walks' | 'some' | 'often'
export type Cook = 'me' | 'family' | 'tiffin' | 'order'
export type Diet = 'veg' | 'egg' | 'nonveg' | 'vegan'
export type Container = 'glass' | 'small' | 'sipper' | 'big'
export type Health = 'pregnant' | 'diabetes' | 'bp' | 'thyroid' | 'none'
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface Answers {
  path?: Path
  goal?: Goal
  sex?: Sex
  age: number
  height: number   // cm
  weight: number   // kg
  target?: number  // kg
  workday?: Workday
  wake: number     // minutes after midnight
  sleep: number
  movement?: Movement
  cooks: Cook[]
  diet?: Diet
  skips: string[]
  container?: Container
  health: Health[]
  notes: string
  // "I have my own plan"
  myCalories: number
  myProtein: number
  myWorkoutDays?: number
  myWater: number  // containers a day
  weighIn?: Weekday
}

export const defaultAnswers: Answers = {
  age: 28,
  height: 170,
  weight: 70,
  wake: 7 * 60,
  sleep: 23 * 60,
  cooks: [],
  skips: [],
  health: [],
  notes: '',
  myCalories: 2000,
  myProtein: 100,
  myWater: 8,
}

const KEY = 'disc.setup'

export function loadAnswers(): { answers: Answers; step: number } {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      return { answers: { ...defaultAnswers, ...saved.answers }, step: saved.step ?? 0 }
    }
  } catch { /* fresh start */ }
  return { answers: { ...defaultAnswers }, step: 0 }
}

export function saveAnswers(answers: Answers, step: number): void {
  try { localStorage.setItem(KEY, JSON.stringify({ answers, step })) } catch { /* private mode */ }
}

export function clearAnswers(): void {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}

export const containerMl: Record<Container, number> = { glass: 250, small: 500, sipper: 750, big: 1000 }
export const containerName: Record<Container, [string, string]> = {
  glass: ['glass', 'glasses'],
  small: ['small bottle', 'small bottles'],
  sipper: ['sipper', 'sippers'],
  big: ['big bottle', 'big bottles'],
}
