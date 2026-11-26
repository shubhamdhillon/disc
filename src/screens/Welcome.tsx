import type { CSSProperties } from 'react'
import Doodles from '../components/Doodles'
import { isInstalled } from '../lib/device'

const delay = (ms: number) => ({ '--d': `${ms}ms` } as CSSProperties)

export default function Welcome({ onContinue }: { onContinue: () => void }) {
  // In a browser tab the account would not carry over to the home-screen app,
  // so the first step there is installing, not signing in.
  const installed = isInstalled()

  return (
    <main className="welcome">
      <div className="welcome__mark welcome__in" style={delay(0)} aria-hidden="true">D</div>
      <h1 className="welcome__title welcome__in" style={delay(120)}>Welcome<br />to Disc</h1>
      <Doodles />
      <p className="welcome__copy welcome__in" style={delay(700)}>
        <span className="welcome__lead">The fitness app for working professionals.</span>
        <span className="welcome__sub">Food, water and workouts, kept on track around your busy day.</span>
      </p>
      <div className="welcome__footer welcome__in" style={delay(820)}>
        <button className="button" onClick={onContinue}>
          {installed ? 'Continue with email' : 'Add Disc to your home screen'}
        </button>
        <p className="welcome__note">
          {installed ? "We'll send you a 6-digit code. No password." : 'Takes 10 seconds. Then open Disc from there.'}
        </p>
      </div>
    </main>
  )
}
