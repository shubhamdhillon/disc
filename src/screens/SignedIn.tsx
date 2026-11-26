import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/* Stand-in until the home screen (Batch 3) is built. Shows the saved plan. */
interface SavedPlan { calories: number; protein: number; waterMl: number }

export default function SignedIn({ email, onSignOut, onSetUp }: { email: string; onSignOut: () => void; onSetUp: () => void }) {
  const [plan, setPlan] = useState<SavedPlan | null | undefined>(undefined)
  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setPlan((data.user?.user_metadata?.plan as SavedPlan) ?? null))
  }, [])
  return (
    <main className="question">
      <div className="question__top" />
      <h1 className="question__title">You're in 🎉</h1>
      <p className="question__help">Signed in as <b style={{ color: 'var(--text)' }}>{email}</b>. The home screen is next on our list.</p>
      {plan && (
        <p className="answer-note">
          Your plan is saved: <b>{plan.calories.toLocaleString('en-IN')} kcal</b>, <b>{plan.protein} g protein</b> and <b>{(plan.waterMl / 1000).toFixed(1)} L water</b> a day.
        </p>
      )}
      {plan === null && (
        <button className="button" style={{ marginTop: 20 }} onClick={onSetUp}>Set up my plan</button>
      )}
      <div className="question__footer">
        <button className="text-button" onClick={async () => { await supabase?.auth.signOut(); onSignOut() }}>
          Sign out (for testing)
        </button>
      </div>
    </main>
  )
}
