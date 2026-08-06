import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

export default function CreateAccount() {
  const navigate = useNavigate()
  const prefersReduced = useReducedMotion() ?? false
  const { data } = useOnboarding()
  // Available for future guards; session updates via AuthProvider on signup/login
  useAuth()

  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isSignup = mode === 'signup'
  const canSubmit = email.trim().length > 0 && password.length >= 6 && !submitting

  async function saveOnboardingToDb(userId: string) {
    try {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        name: null,
        goal: data.goal,
        trains: data.workoutFrequency !== 'No' && data.workoutFrequency != null,
      })
      if (profileError) console.error('Failed to save profile:', profileError)

      if (data.targets) {
        const { error: targetsError } = await supabase.from('targets').insert({
          user_id: userId,
          calories: data.targets.calories,
          protein:  data.targets.protein,
          carbs:    data.targets.carbs,
          fat:      data.targets.fat,
        })
        if (targetsError) console.error('Failed to save targets:', targetsError)
      }
    } catch (err) {
      console.error('Failed to save onboarding data:', err)
    }
  }

  async function handleSignup() {
    setError(null)
    setSubmitting(true)
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
      if (authData.user?.id) {
        await saveOnboardingToDb(authData.user.id)
      }
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

  return (
    <motion.div
      className="flex h-dvh w-full flex-col bg-white"
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div
        className="flex flex-1 flex-col px-6"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 56px)' }}
      >
        <h1 className="m-0 text-[28px] font-bold tracking-tight text-gray-900">
          {isSignup ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mb-0 mt-2 text-[15px] text-gray-500">
          {isSignup ? "Let's save your progress" : 'Log in to keep tracking'}
        </p>

        <form className="mt-8 flex flex-col gap-3" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-gray-600">Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null) }}
              placeholder="you@email.com"
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-[16px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-gray-600">Password</span>
            <input
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null) }}
              placeholder="At least 6 characters"
              minLength={6}
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-[16px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400"
            />
          </label>

          {error && (
            <p className="mb-0 mt-1 text-[14px] leading-snug text-red-500" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-3 flex h-[52px] w-full items-center justify-center rounded-2xl text-[16px] font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: BRAND_GREEN }}
          >
            {submitting
              ? (isSignup ? 'Creating…' : 'Logging in…')
              : (isSignup ? 'Create account' : 'Log in')}
          </button>
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
