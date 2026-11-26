import { useState, type FormEvent } from 'react'
import BackButton from '../components/BackButton'
import { supabase } from '../lib/supabase'

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

export function friendlyError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('rate limit') || m.includes('security purposes')) return "We've sent a few codes already. Give it a minute and try again."
  if (m.includes('not authorized')) return "We can't email that address yet. Disc is still in testing."
  if (m.includes('fetch') || m.includes('network')) return "Couldn't reach us. Check your internet and try again."
  return 'Something went wrong on our side. Try again?'
}

export default function Email({ initial, onBack, onSent }: {
  initial: string
  onBack: () => void
  onSent: (email: string) => void
}) {
  const [email, setEmail] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!looksLikeEmail(email) || busy) return
    if (!supabase) { setError("Sign-in isn't set up on this version yet."); return }
    setBusy(true)
    setError('')
    const clean = email.trim().toLowerCase()
    const { error } = await supabase.auth.signInWithOtp({ email: clean, options: { shouldCreateUser: true } })
    setBusy(false)
    if (error) setError(friendlyError(error.message))
    else onSent(clean)
  }

  return (
    <form className="question" onSubmit={send} noValidate>
      <div className="question__top"><BackButton onClick={onBack} /></div>
      <h1 className="question__title">What's your email?</h1>
      <p className="question__help">We'll send you a 6-digit code. No password needed.</p>

      <input
        className="field"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="send"
        placeholder="you@work.com"
        autoFocus
        value={email}
        onChange={e => { setEmail(e.target.value); setError('') }}
        aria-label="Email"
      />
      {error
        ? <p className="field-note field-note--error" role="alert">{error}</p>
        : <p className="field-note">Only used to sign you in. No newsletters.</p>}

      <div className="question__footer">
        <button className="button" type="submit" disabled={!looksLikeEmail(email) || busy}>
          {busy ? 'Sending…' : 'Send my code'}
        </button>
      </div>
    </form>
  )
}
