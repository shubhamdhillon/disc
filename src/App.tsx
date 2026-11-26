import { useCallback, useEffect, useRef, useState } from 'react'
import { StickerDefs } from './components/Stickers'
import Splash from './screens/Splash'
import Welcome from './screens/Welcome'
import Install from './screens/Install'
import Onboarding from './screens/Onboarding'
import PlanReveal from './screens/PlanReveal'
import Email from './screens/Email'
import Code from './screens/Code'
import SignedIn from './screens/SignedIn'
import { canPromptInstall, isInstalled, promptInstall } from './lib/device'
import { supabase } from './lib/supabase'
import { clearAnswers, loadAnswers, type Answers } from './onboarding/answers'
import { buildPlan } from './onboarding/plan'

/*
  Flow
  Splash → Welcome
    Start my journey      → setup questions → plan → email → code → saved → home
    I already have one    → email → code → home
  In a browser tab both buttons go to "add to home screen" first: iPhone keeps
  the home-screen app's data apart from Safari's, so answers given in Safari
  would be lost after installing.
*/
type Screen = 'splash' | 'welcome' | 'install' | 'setup' | 'plan' | 'email' | 'code' | 'in'
type Mode = 'save' | 'signin'

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash')
  const [mode, setMode] = useState<Mode>('signin')
  const [answers, setAnswers] = useState<Answers>(() => loadAnswers().answers)
  const [email, setEmail] = useState('')
  const [signedInAs, setSignedInAs] = useState<string | null>(null)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => {
      if (data.session?.user.email) setSignedInAs(data.session.user.email)
    })
  }, [])

  // Read through a ref so the splash timer isn't restarted when the session loads
  const signedInRef = useRef(signedInAs)
  signedInRef.current = signedInAs
  const afterSplash = useCallback(() => setScreen(signedInRef.current ? 'in' : 'welcome'), [])

  async function needsInstall(): Promise<boolean> {
    if (isInstalled()) return false
    if (canPromptInstall()) { await promptInstall(); return true }
    setScreen('install')
    return true
  }

  async function start() {
    if (await needsInstall()) return
    setScreen('setup')
  }
  async function signIn() {
    if (await needsInstall()) return
    setMode('signin')
    setScreen('email')
  }

  async function savePlan() {
    if (!supabase) return
    const plan = buildPlan(answers)
    const { error } = await supabase.auth.updateUser({
      data: { setup: answers, plan: { calories: plan.calories, protein: plan.protein, waterMl: plan.waterMl } },
    })
    if (error) setSaveError("Signed in, but the plan didn't save. We'll try again.")
    else clearAnswers()
  }

  async function verified() {
    setSignedInAs(email)
    if (mode === 'save') await savePlan()
    setScreen('in')
  }

  // Already signed in (set up again from the home screen)? Save straight away.
  async function onSave() {
    if (signedInAs) { await savePlan(); setScreen('in'); return }
    setMode('save')
    setScreen('email')
  }

  return (
    <div className="app" data-ground="charcoal">
      <StickerDefs />
      {screen === 'splash' && <Splash onDone={afterSplash} />}
      {screen === 'welcome' && <Welcome onStart={start} onSignIn={signIn} />}
      {screen === 'install' && <Install onBack={() => setScreen('welcome')} />}
      {screen === 'setup' && (
        <Onboarding onExit={() => setScreen('welcome')} onDone={a => { setAnswers(a); setScreen('plan') }} />
      )}
      {screen === 'plan' && (
        <PlanReveal answers={answers} onBack={() => setScreen('setup')} onSave={onSave} />
      )}
      {screen === 'email' && (
        <Email initial={email} mode={mode}
          onBack={() => setScreen(mode === 'save' ? 'plan' : 'welcome')}
          onSent={e => { setEmail(e); setScreen('code') }} />
      )}
      {screen === 'code' && <Code email={email} onBack={() => setScreen('email')} onVerified={verified} />}
      {screen === 'in' && (
        <>
          <SignedIn email={signedInAs ?? email} onSetUp={() => setScreen('setup')}
            onSignOut={() => { setSignedInAs(null); setScreen('welcome') }} />
          {saveError && <p className="field-note field-note--error" style={{ position: 'absolute', bottom: 90, left: 22, right: 22 }}>{saveError}</p>}
        </>
      )}
    </div>
  )
}
