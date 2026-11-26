import { useCallback, useEffect, useRef, useState } from 'react'
import { StickerDefs } from './components/Stickers'
import Splash from './screens/Splash'
import Welcome from './screens/Welcome'
import Install from './screens/Install'
import Email from './screens/Email'
import Code from './screens/Code'
import SignedIn from './screens/SignedIn'
import { canPromptInstall, isInstalled, promptInstall } from './lib/device'
import { supabase } from './lib/supabase'

type Screen = 'splash' | 'welcome' | 'install' | 'email' | 'code' | 'in'

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash')
  const [email, setEmail] = useState('')
  const [signedInAs, setSignedInAs] = useState<string | null>(null)

  // Already signed in from an earlier visit? Skip the welcome after the splash.
  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => {
      if (data.session?.user.email) setSignedInAs(data.session.user.email)
    })
  }, [])

  // Read through a ref so the splash timer isn't restarted when the session loads
  const signedInRef = useRef(signedInAs)
  signedInRef.current = signedInAs
  const afterSplash = useCallback(() => setScreen(signedInRef.current ? 'in' : 'welcome'), [])

  async function fromWelcome() {
    if (isInstalled()) { setScreen('email'); return }
    if (canPromptInstall()) { await promptInstall(); return }
    setScreen('install')
  }

  return (
    <div className="app" data-ground="charcoal">
      <StickerDefs />
      {screen === 'splash' && <Splash onDone={afterSplash} />}
      {screen === 'welcome' && <Welcome onContinue={fromWelcome} />}
      {screen === 'install' && <Install onBack={() => setScreen('welcome')} />}
      {screen === 'email' && (
        <Email initial={email} onBack={() => setScreen('welcome')}
          onSent={e => { setEmail(e); setScreen('code') }} />
      )}
      {screen === 'code' && (
        <Code email={email} onBack={() => setScreen('email')}
          onVerified={() => { setSignedInAs(email); setScreen('in') }} />
      )}
      {screen === 'in' && (
        <SignedIn email={signedInAs ?? email} onSignOut={() => { setSignedInAs(null); setScreen('welcome') }} />
      )}
    </div>
  )
}
