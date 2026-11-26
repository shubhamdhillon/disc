import { createContext, useContext, useState, useEffect } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthCtxType {
  session: Session | null
  user:    User | null
  loading: boolean
  signupInProgress: boolean
  setSignupInProgress: (v: boolean) => void
}

const AuthCtx = createContext<AuthCtxType>({
  session: null,
  user: null,
  loading: true,
  signupInProgress: false,
  setSignupInProgress: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [signupInProgress, setSignupInProgress] = useState(false)

  useEffect(() => {
    // Get the current session on mount (restores login across refreshes)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    // Listen for auth changes (login, logout, token refresh)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <AuthCtx.Provider value={{
      session,
      user: session?.user ?? null,
      loading,
      signupInProgress,
      setSignupInProgress,
    }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  return useContext(AuthCtx)
}
