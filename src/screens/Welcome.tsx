import type { CSSProperties } from 'react'
import Doodles from '../components/Doodles'

const delay = (ms: number) => ({ '--d': `${ms}ms` } as CSSProperties)

export default function Welcome({ onStart, onSignIn }: { onStart: () => void; onSignIn: () => void }) {

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
        <button className="button" onClick={onStart}>Start my journey</button>
        <button className="button button--quiet welcome__second" onClick={onSignIn}>I already have an account</button>
      </div>
    </main>
  )
}
