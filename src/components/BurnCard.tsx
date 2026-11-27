import { useEffect, useRef, useState } from 'react'
import { I } from './icons'
import { burnSoFar, type BurnStep } from '../onboarding/plan'
import type { Answers } from '../onboarding/answers'

/* What you burn in a day, from the answers so far. Sits under the answers on
   the screens whose answer changes it, and counts to the new number on tap. */
export default function BurnCard({ a, step }: { a: Answers; step: BurnStep }) {
  const { now, delta } = burnSoFar(a, step)
  const shown = useCountUp(now)
  return (
    <div className="burn" aria-live="polite">
      <span className="burn__icon"><I name="flame" /></span>
      <div className="burn__text">
        <p className="burn__label">{step === 'body' ? 'Resting, your body burns about' : 'You burn about'}</p>
        <p className="burn__line">
          <span className="burn__num">{shown.toLocaleString('en-IN')}</span>
          <span className="burn__unit">calories a day</span>
        </p>
      </div>
      {delta > 0 && <span key={delta} className="burn__delta">+{delta.toLocaleString('en-IN')}</span>}
    </div>
  )
}

function useCountUp(target: number, ms = 600) {
  const [value, setValue] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = from.current
    if (start === target || matchMedia('(prefers-reduced-motion: reduce)').matches) { from.current = target; setValue(target); return }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      const v = Math.round(start + (target - start) * (1 - Math.pow(1 - p, 3)))
      from.current = v
      setValue(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return value
}
