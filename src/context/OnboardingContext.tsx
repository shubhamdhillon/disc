import { createContext, useContext, useState } from 'react'

// ── Shared onboarding state ────────────────────────────────────────────────────
// One place for all data collected across the 9 onboarding screens.
// Add new fields here as you build each subsequent screen.

export interface OnboardingData {
  // Screen 1 — Body basics
  gender:      'male' | 'female' | 'other' | null
  birthDay:    number        // 1–31
  birthMonth:  number        // 1–12
  birthYear:   number        // e.g. 1995
  heightCm:    number        // 120–220
  weightKg:    number        // 30–200 (e.g. 70.5)

  // Screen 2 — Work day
  workDay:     string | null // e.g. "Mostly sitting"

  // Screen 3 — Steps
  stepsPerDay: string | null // e.g. "Under 3k"

  // Screen 4 — Workout frequency
  workoutFrequency: string | null // e.g. "1-2 days/week" | "No"

  // Screen 5 — Workout type (null when frequency is "No")
  workoutType: string | null // e.g. "Weights"

  // Screen 6 — Workout length (null when frequency is "No")
  workoutLength: string | null // e.g. "30-60 min"

  // Screen 7 — Goal
  goal: string | null // e.g. "Lose fat"

  // Screen 8 — Diet preference
  dietPreference: string | null // e.g. "Vegetarian"

  // Screen 9 — Food preparation
  foodPrep: string | null // e.g. "I cook for myself"

  // Computed after screen 9
  targets: { calories: number; protein: number; carbs: number; fat: number } | null
}

const DEFAULTS: OnboardingData = {
  gender:      null,
  birthDay:    15,
  birthMonth:  6,
  birthYear:   1995,
  heightCm:    170,
  weightKg:    70,
  workDay:          null,
  stepsPerDay:      null,
  workoutFrequency: null,
  workoutType:      null,
  workoutLength:    null,
  goal:             null,
  dietPreference:   null,
  foodPrep:         null,
  targets:          null,
}

interface OnboardingCtxType {
  data:   OnboardingData
  update: (patch: Partial<OnboardingData>) => void
}

const OnboardingCtx = createContext<OnboardingCtxType | null>(null)

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OnboardingData>(DEFAULTS)
  const update = (patch: Partial<OnboardingData>) =>
    setData(prev => ({ ...prev, ...patch }))
  return (
    <OnboardingCtx.Provider value={{ data, update }}>
      {children}
    </OnboardingCtx.Provider>
  )
}

// Use this hook in any onboarding screen to read or write collected data.
export function useOnboarding() {
  const ctx = useContext(OnboardingCtx)
  if (!ctx) throw new Error('useOnboarding must be called inside <OnboardingProvider>')
  return ctx
}
