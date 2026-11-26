/*
  Setup answers. Kept on the phone (localStorage) while the user answers,
  so closing the app mid-way loses nothing. Saved to the account after sign-up.
*/

export type Path = 'build' | 'own'
export type Goal = 'lose' | 'recomp' | 'muscle' | 'steady' | 'better'
export type Sex = 'male' | 'female' | 'unsaid'
export type Workday = 'sitting' | 'mix' | 'feet'
export type Steps = 'low' | 'some' | 'good' | 'lots'
export type Workouts = 'none' | 'some' | 'regular' | 'lots'
export type WorkoutType = 'weights' | 'home' | 'cardio' | 'yoga' | 'sport'
export type Variety = 'same' | 'rotate' | 'varies'
export type Cook = 'me' | 'family' | 'tiffin' | 'order' | 'out'
export type Diet = 'veg' | 'egg' | 'nonveg' | 'vegan'
export type Container = 'glass' | 'small' | 'sipper' | 'big'
export type Health = 'pregnant' | 'diabetes' | 'bp' | 'thyroid' | 'pcos' | 'kidney' | 'eating' | 'none'
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface Answers {
  path?: Path
  goal?: Goal
  sex?: Sex
  age: number
  height: number   // cm, always stored in cm
  heightUnit: 'cm' | 'ft'
  weight: number   // kg
  target?: number  // kg
  workday?: Workday
  wake: number     // minutes after midnight
  sleep: number
  steps?: Steps
  workouts?: Workouts
  workoutTypes: WorkoutType[]
  cooks: Cook[]
  variety?: Variety
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
  myWaterMl?: number         // from an uploaded plan, turned into containers once we know which
  planSource?: 'upload' | 'type'
  planFound?: { summary?: string; estimated: boolean; found: string[] }
  weighIn?: Weekday
}

export const defaultAnswers: Answers = {
  age: 28,
  height: 170,
  heightUnit: 'cm',
  weight: 70,
  wake: 7 * 60,
  sleep: 23 * 60,
  workoutTypes: [],
  cooks: [],
  skips: [],
  health: [],
  notes: '',
  myCalories: 2000,
  myProtein: 100,
  myWater: 8,
}

const KEY = 'disc.setup.v2'  // v2: questions changed 26 Nov, old saved answers are ignored

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

/** BMI from kg and cm. Used only for safety limits, never shown as a judgement. */
export const bmi = (kg: number, cm: number) => kg / (cm / 100) ** 2
/** The lowest weight we'll help anyone aim for: BMI 18.5 at their height. */
export const lowestHealthy = (cm: number) => Math.ceil(18.5 * (cm / 100) ** 2)
