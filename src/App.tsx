import { useCallback, useState } from 'react'
import { StickerDefs } from './components/Stickers'
import Splash from './screens/Splash'
import Welcome from './screens/Welcome'

type Screen = 'splash' | 'welcome'

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash')
  const toWelcome = useCallback(() => setScreen('welcome'), [])

  return (
    <div data-ground="charcoal" style={{ minHeight: '100%' }}>
      <StickerDefs />
      {screen === 'splash' && <Splash onDone={toWelcome} />}
      {screen === 'welcome' && (
        // Next in Batch 1: install guide and email sign-in
        <Welcome onContinue={() => {}} />
      )}
    </div>
  )
}
