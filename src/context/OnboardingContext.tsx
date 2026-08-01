import { createContext, useContext, useState } from 'react'

// ── Shared onboarding state ────────────────────────────────────────────────────
// One place for all data collected across the 9 onboarding screens.
// Add new fields here as you build each subsequent screen.

export interface OnboardingData {
  // Screen 1 — Body basics
  gender:     'male' | 'female' | 'other' | null
  birthDay:   number   // 1–31
  birthMonth: number   // 1–12
  birthYear:  number   // e.g. 1995
  heightCm:   number   // 120–220
  weightKg:   number   // 30–200 (e.g. 70.5)

  // Screens 2–8 — add fields below as you build them
  // activityLevel: string | null
  // goal: string | null
  // dietaryPreference: string | null
  // etc.
}

const DEFAULTS: OnboardingData = {
  gender:     null,
  birthDay:   15,
  birthMonth: 6,
  birthYear:  1995,
  heightCm:   170,
  weightKg:   70,
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
