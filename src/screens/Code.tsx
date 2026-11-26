import { useEffect, useRef, useState } from 'react'
import BackButton from '../components/BackButton'
import { supabase } from '../lib/supabase'
import { friendlyError } from './Email'

const LENGTH = 6
const RESEND_AFTER = 60

export default function Code({ email, onBack, onVerified }: {
  email: string
  onBack: () => void
  onVerified: () => void
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState(false)
  const [error, setError] = useState('')
  const [wait, setWait] = useState(RESEND_AFTER)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait(w => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  async function verify(token: string) {
    if (!supabase) return
    setBusy(true)
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    setBusy(false)
    if (!error) { onVerified(); return }
    const m = error.message.toLowerCase()
    if (m.includes('expired') || m.includes('invalid') || m.includes('token')) {
      setWrong(true)
      // Supabase gives the same message for a wrong code and an old one
      setError("That's not the one. Try again?")
    } else {
      setError(friendlyError(error.message))
    }
  }

  function change(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, LENGTH)
    setCode(digits)
    if (wrong || error) { setWrong(false); setError('') }
    if (digits.length === LENGTH) verify(digits)
  }

  // After a wrong code, clear the boxes once the shake has played
  useEffect(() => {
    if (!wrong) return
    const t = setTimeout(() => { setCode(''); setWrong(false); input.current?.focus() }, 900)
    return () => clearTimeout(t)
  }, [wrong])

  async function resend() {
    if (!supabase || wait > 0) return
    setWait(RESEND_AFTER)
    setError('')
    setWrong(false)
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) setError(friendlyError(error.message))
  }

  const mm = Math.floor(wait / 60)
  const ss = String(wait % 60).padStart(2, '0')

  return (
    <main className="question">
      <div className="question__top"><BackButton onClick={onBack} /></div>
      <h1 className="question__title">Check your email</h1>
      <p className="question__help">
        We sent a code to <b style={{ color: 'var(--text)' }}>{email}</b>.
        <button className="text-link" style={{ display: 'block', marginTop: 2 }} onClick={onBack}>Wrong email?</button>
      </p>

      <div className={`code-input${wrong ? ' is-wrong' : ''}${busy ? ' is-busy' : ''}`}>
        {Array.from({ length: LENGTH }, (_, i) => (
          <div key={i} className={`code-input__box${!wrong && !busy && i === code.length ? ' is-active' : ''}`}>
            {code[i] ?? ''}
          </div>
        ))}
        <input
          ref={input}
          className="code-input__real"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={LENGTH}
          autoFocus
          value={code}
          disabled={busy}
          onChange={e => change(e.target.value)}
          aria-label={`${LENGTH}-digit code`}
        />
      </div>

      {error && <p className="code-help code-help--error" role="alert">{error}</p>}
      <p className="code-help" style={error ? { marginTop: 6 } : undefined}>
        {wait > 0
          ? <>Didn't get it? You can ask for a new one in {mm}:{ss}</>
          : <button className="text-link" onClick={resend}>Send a new code</button>}
      </p>
    </main>
  )
}
