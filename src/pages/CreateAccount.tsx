import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useOnboarding } from '../context/OnboardingContext'
import { useAuth } from '../context/AuthContext'

const BRAND_GREEN = '#1C7C2E'

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('already registered') || m.includes('already been registered')) {
    return "That email's already in use — try logging in."
  }
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return 'Wrong email or password.'
  }
  if (m.includes('password') && (m.includes('6') || m.includes('weak') || m.includes('least'))) {
    return 'Password needs at least 6 characters.'
  }
  return message
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export default function CreateAccount() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const prefersReduced = useReducedMotion() ?? false
  const { data } = useOnboarding()
  const { setSignupInProgress } = useAuth()

  const [mode, setMode] = useState<'signup' | 'login'>(
    params.get('mode') === 'login' ? 'login' : 'signup',
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  const isSignup = mode === 'signup'
  const canSubmit = email.trim().length > 0 && password.length >= 6 && !submitting

  async function saveOnboardingToDb(
    userId: string,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    if (!data.targets) {
      const reason = 'Your targets are missing. Please redo onboarding.'
      console.error('Failed to save targets:', reason)
      return { ok: false, reason }
    }

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      name: null,
      goal: data.goal,
      trains: data.workoutFrequency !== 'No' && data.workoutFrequency != null,
    })
    if (profileError) {
      console.error('Failed to save profile:', profileError)
      return { ok: false, reason: profileError.message }
    }

    const { error: targetsError } = await supabase.from('targets').insert({
      user_id: userId,
      calories: data.targets.calories,
      protein:  data.targets.protein,
      carbs:    data.targets.carbs,
      fat:      data.targets.fat,
    })
    if (targetsError) {
      console.error('Failed to save targets:', targetsError)
      return { ok: false, reason: targetsError.message }
    }

    return { ok: true }
  }

  async function handleSignup() {
    setSignupInProgress(true)
    setError(null)
    setSaveFailed(false)
    setSubmitting(true)
    let succeeded = false
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })
      if (authError) {
        setError(friendlyAuthError(authError.message))
        return
      }
      if (!authData.session) {
        // Email confirmation is on — user created but not authenticated yet.
        // Can't write to RLS-protected tables without a session.
        setError('Check your email to confirm your account, then log in.')
        return
      }
      // Session exists — safe to write onboarding data
      if (!authData.user?.id) {
        setError("Couldn't finish signup — please try again.")
        setSaveFailed(true)
        return
      }
      const result = await saveOnboardingToDb(authData.user.id)
      if (!result.ok) {
        setError(result.reason)
        setSaveFailed(true)
        return
      }
      succeeded = true
      navigate('/today')
    } finally {
      setSubmitting(false)
      if (succeeded) setSignupInProgress(false)
    }
  }

  async function handleRetrySave() {
    setError(null)
    setSubmitting(true)
    try {
      const uid = (await supabase.auth.getUser()).data.user?.id
      if (!uid) {
        setError("Couldn't find your account — please try logging in.")
        return
      }
      const result = await saveOnboardingToDb(uid)
      if (!result.ok) {
        setError(result.reason)
        setSaveFailed(true)
        return
      }
      setSaveFailed(false)
      setSignupInProgress(false)
      navigate('/today')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogin() {
    setError(null)
    setSubmitting(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (authError) {
        setError(friendlyAuthError(authError.message))
        return
      }
      navigate('/today')
    } finally {
      setSubmitting(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    if (password.length < 6) {
      setError('Password needs at least 6 characters.')
      return
    }
    if (isSignup) void handleSignup()
    else void handleLogin()
  }

  function handleGoogle() {
    console.log('google auth coming soon')
  }

  return (
    <motion.div
      className="flex h-dvh w-full flex-col overflow-hidden bg-white"
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {/* ── Dark grainy aurora header ── */}
      <div
        className="relative flex w-full flex-shrink-0 flex-col justify-end overflow-hidden px-6 pb-12"
        style={{
          height: '38%',
          minHeight: 220,
          paddingTop: 'max(env(safe-area-inset-top, 0px), 24px)',
          backgroundColor: '#0A3D1E',
        }}
      >
        {/* Flowing aurora layers — transform-only animation (GPU-friendly) */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute will-change-transform"
          style={{
            inset: '-40%',
            background:
              'radial-gradient(ellipse 55% 50% at 35% 30%, #124A28 0%, transparent 70%)',
          }}
          animate={
            prefersReduced
              ? { x: 0, y: 0 }
              : { x: ['0%', '8%', '-4%', '0%'], y: ['0%', '-6%', '5%', '0%'] }
          }
          transition={
            prefersReduced
              ? { duration: 0 }
              : { duration: 28, repeat: Infinity, ease: 'easeInOut' }
          }
        />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute will-change-transform"
          style={{
            inset: '-45%',
            background:
              'radial-gradient(ellipse 45% 40% at 70% 45%, rgba(163,230,53,0.55) 0%, transparent 65%)',
            filter: 'blur(28px)',
          }}
          animate={
            prefersReduced
              ? { x: 0, y: 0 }
              : { x: ['0%', '-10%', '6%', '0%'], y: ['0%', '7%', '-5%', '0%'] }
          }
          transition={
            prefersReduced
              ? { duration: 0 }
              : { duration: 22, repeat: Infinity, ease: 'easeInOut' }
          }
        />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute will-change-transform"
          style={{
            inset: '-40%',
            background:
              'radial-gradient(ellipse 50% 45% at 45% 75%, #2E9E5B 0%, transparent 68%)',
            filter: 'blur(20px)',
          }}
          animate={
            prefersReduced
              ? { x: 0, y: 0 }
              : { x: ['0%', '7%', '-8%', '0%'], y: ['0%', '-4%', '8%', '0%'] }
          }
          transition={
            prefersReduced
              ? { duration: 0 }
              : { duration: 18, repeat: Infinity, ease: 'easeInOut' }
          }
        />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute will-change-transform"
          style={{
            inset: '-50%',
            background:
              'radial-gradient(ellipse 35% 30% at 20% 60%, rgba(127,201,72,0.4) 0%, transparent 60%)',
            filter: 'blur(24px)',
          }}
          animate={
            prefersReduced
              ? { x: 0, y: 0 }
              : { x: ['0%', '5%', '-7%', '0%'], y: ['0%', '9%', '-3%', '0%'] }
          }
          transition={
            prefersReduced
              ? { duration: 0 }
              : { duration: 25, repeat: Infinity, ease: 'easeInOut' }
          }
        />

        {/* Fine grain — sandy particles over the aurora */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            opacity: 0.18,
            mixBlendMode: 'overlay',
            backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
              `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
                <filter id='n'>
                  <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/>
                </filter>
                <rect width='100%' height='100%' filter='url(#n)'/>
              </svg>`,
            )}")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '160px 160px',
          }}
        />

        <div className="relative z-10">
          <h1 className="m-0 text-[30px] font-bold tracking-tight text-white">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p
            className="mb-0 mt-2 text-[15px]"
            style={{ color: 'rgba(255,255,255,0.8)' }}
          >
            {isSignup ? "Let's save your progress" : 'Log in to keep tracking'}
          </p>
        </div>
      </div>

      {/* ── Bottom sheet card ── */}
      <div
        className="relative z-10 -mt-6 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-t-[28px] bg-white px-6 pt-7 shadow-[0_-8px_32px_rgba(0,0,0,0.12)]"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 28px)' }}
      >
        {/* Google placeholder */}
        <button
          type="button"
          onClick={handleGoogle}
          className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl border border-gray-200 bg-white text-[15px] font-semibold text-gray-800 transition-colors active:bg-gray-50"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Or divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-100" />
          <span className="text-[13px] font-medium text-gray-400">or</span>
          <div className="h-px flex-1 bg-gray-100" />
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-label="Email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(null) }}
            placeholder="Email"
            className="h-12 w-full rounded-xl border-0 bg-gray-50 px-4 text-[16px] text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-gray-200"
          />

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              aria-label="Password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null) }}
              placeholder="Password"
              minLength={6}
              className="h-12 w-full rounded-xl border-0 bg-gray-50 py-0 pl-4 pr-12 text-[16px] text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-gray-200"
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center"
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>

          {error && (
            <p className="mb-0 mt-1 text-[14px] leading-snug text-red-500" role="alert">
              {error}
            </p>
          )}

          {saveFailed ? (
            <button
              type="button"
              onClick={() => void handleRetrySave()}
              disabled={submitting}
              className="mt-2 flex h-[52px] w-full items-center justify-center rounded-2xl text-[16px] font-semibold text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: BRAND_GREEN }}
            >
              {submitting ? 'Saving…' : 'Try again'}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-2 flex h-[52px] w-full items-center justify-center rounded-2xl text-[16px] font-semibold text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: BRAND_GREEN }}
            >
              {submitting
                ? (isSignup ? 'Creating…' : 'Logging in…')
                : (isSignup ? 'Create account' : 'Log in')}
            </button>
          )}
        </form>

        <p className="mt-5 text-center text-[14px] text-gray-500">
          {isSignup ? (
            <>
              Already have an account?{' '}
              <button
                type="button"
                className="font-semibold"
                style={{ color: BRAND_GREEN }}
                onClick={() => { setMode('login'); setError(null) }}
              >
                Log in
              </button>
            </>
          ) : (
            <>
              New here?{' '}
              <button
                type="button"
                className="font-semibold"
                style={{ color: BRAND_GREEN }}
                onClick={() => { setMode('signup'); setError(null) }}
              >
                Create account
              </button>
            </>
          )}
        </p>
      </div>
    </motion.div>
  )
}
