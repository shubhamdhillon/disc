import BackButton from '../components/BackButton'
import { isIOS } from '../lib/device'

const Dots = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r=".6" /><circle cx="8" cy="8" r=".6" /><circle cx="13" cy="8" r=".6" /></svg>
)
const Share = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10V2M5 4.5 8 1.5l3 3M4 7H3v8h10V7h-1" /></svg>
)

export default function Install({ onBack }: { onBack: () => void }) {
  const ios = isIOS()

  return (
    <main className="question">
      <div className="question__top"><BackButton onClick={onBack} /></div>

      <div className="install-art" aria-hidden="true">
        <i className="install-art__app" />
        <i className="install-art__app install-art__app--disc"><span>D</span></i>
        <i className="install-art__app" />
        <i className="install-art__app" />
      </div>

      <h1 className="question__title">Put Disc on your home screen</h1>
      <p className="question__help">
        {ios
          ? 'Takes 10 seconds. iPhone keeps home-screen apps separate from Safari, so this way you only sign in once.'
          : 'Takes 10 seconds. Then Disc opens like any other app.'}
      </p>

      {ios ? (
        <ol className="install-steps">
          <li className="install-step"><span className="install-step__num">1</span>
            <span>Tap <span className="chip"><Dots /></span> then <b>Share</b> <span className="chip"><Share /></span></span></li>
          <li className="install-step"><span className="install-step__num">2</span>
            <span>Scroll down, tap <span className="chip">Add to Home Screen</span></span></li>
          <li className="install-step"><span className="install-step__num">3</span>
            <span>Tap <b>Add</b>, then open Disc from your home screen
              <span className="install-step__small">Leave "Open as Web App" switched on.</span></span></li>
        </ol>
      ) : (
        <ol className="install-steps">
          <li className="install-step"><span className="install-step__num">1</span>
            <span>Open your browser menu <span className="chip"><Dots /></span></span></li>
          <li className="install-step"><span className="install-step__num">2</span>
            <span>Tap <span className="chip">Install app</span> or <span className="chip">Add to home screen</span></span></li>
          <li className="install-step"><span className="install-step__num">3</span>
            <span>Open Disc from your home screen</span></li>
        </ol>
      )}

      {ios && (
        <svg className="install-arrow" viewBox="0 0 34 46" aria-hidden="true"><path d="M17 4v34M5 27l12 13 12-13" /></svg>
      )}
    </main>
  )
}
