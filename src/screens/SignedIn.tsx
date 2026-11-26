import { supabase } from '../lib/supabase'

/* Stand-in until Batch 2: the fork question comes here. */
export default function SignedIn({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <main className="question">
      <div className="question__top" />
      <h1 className="question__title">You're in 🎉</h1>
      <p className="question__help">Signed in as <b style={{ color: 'var(--text)' }}>{email}</b>. Setting up your plan comes next.</p>
      <div className="question__footer">
        <button className="text-link" onClick={async () => { await supabase?.auth.signOut(); onSignOut() }}>
          Sign out (for testing)
        </button>
      </div>
    </main>
  )
}
