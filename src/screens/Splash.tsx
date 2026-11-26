import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Sticker, type StickerName } from '../components/Stickers'

const SEEN_KEY = 'disc.splashSeen'

/* Where each food lands on the bowl's rim (px, relative to the bowl), when it falls, and its tumble */
const FOODS: { name: StickerName; size: number; x: number; y: number; delay: number; from: number; to: number }[] = [
  { name: 'tomato', size: 44, x: 2, y: -10, delay: 550, from: -40, to: -12 },
  { name: 'lemon', size: 36, x: 46, y: -6, delay: 700, from: 30, to: 8 },
  { name: 'leaf', size: 48, x: 20, y: -20, delay: 850, from: -70, to: -28 },
]

function hasSeenSplash() {
  try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return false }
}

export default function Splash({ onDone }: { onDone: () => void }) {
  const [short] = useState(hasSeenSplash)
  const [leaving, setLeaving] = useState(false)
  const restRef = useRef<HTMLSpanElement>(null)
  const [restWidth, setRestWidth] = useState(0)

  // "isc" slides out to its natural width; measure it once the logo font is in
  useLayoutEffect(() => {
    let alive = true
    document.fonts.ready.then(() => {
      if (alive && restRef.current) setRestWidth(restRef.current.offsetWidth)
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    try { localStorage.setItem(SEEN_KEY, '1') } catch { /* private mode: play full every time */ }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const total = reduce ? 900 : short ? 1500 : 2900
    const leave = setTimeout(() => setLeaving(true), total)
    const done = setTimeout(onDone, total + 280)
    return () => { clearTimeout(leave); clearTimeout(done) }
  }, [short, onDone])

  return (
    <div
      className={`splash${short ? ' splash--short' : ''}${leaving ? ' is-leaving' : ''}`}
      style={{ '--rest-width': `${restWidth}px` } as CSSProperties}
      role="img"
      aria-label="Disc. Discipline, kept steady."
    >
      <div className="splash__word">
        <div className="splash__drop">
          <div className="splash__bob">
            <div className="splash__items">
              {FOODS.map(f => (
                <div
                  key={f.name}
                  className="splash__item"
                  style={{
                    '--s': `${f.size}px`, '--x': `${f.x}px`, '--y': `${f.y}px`,
                    '--t': `${f.delay}ms`, '--r0': `${f.from}deg`, '--r1': `${f.to}deg`,
                  } as CSSProperties}
                >
                  <Sticker name={f.name} />
                </div>
              ))}
            </div>
            <span className="splash__bowl">D</span>
          </div>
        </div>
        <div className="splash__rest"><span ref={restRef}>isc</span></div>
      </div>
      <p className="splash__tag">Discipline, kept steady.</p>
    </div>
  )
}
