import { useEffect, useRef, useState, type CSSProperties } from 'react'
import BackButton from '../components/BackButton'
import { I, type IconName } from '../components/icons'
import type { Answers } from '../onboarding/answers'
import { buildPlan, type PlanLine } from '../onboarding/plan'

/* The end of setup. One big number leads; the rest is a flat list split into
   each day and each week. Reasons open on tap. Saving is where the account comes in. */

const icons: Record<string, IconName> = { cal: 'flame', protein: 'bowl-food', water: 'drop', walk: 'person-simple-walk', weigh: 'calendar-check' }

function titleFor(a: Answers): string {
  if (a.path === 'own') return 'Your numbers, all in one place'
  const day = { sitting: 'a desk job', mix: 'a mixed workday', feet: 'a day on your feet' }[a.workday ?? 'sitting']
  const kind = a.workouts && a.workouts !== 'none' && a.workoutTypes.length
    ? { weights: 'gym sessions', home: 'home workouts', cardio: 'running and cycling', yoga: 'yoga', sport: 'your sport' }[a.workoutTypes[0]]
    : null
  return kind ? `Built around ${day} and ${kind}` : `Built around ${day}`
}

export default function PlanReveal({ answers, onBack, onEdit, onSave }: {
  answers: Answers
  onBack: () => void
  onEdit: () => void
  onSave: () => void
}) {
  const plan = buildPlan(answers)
  const hero = plan.lines.find(l => l.group === 'hero')
  const [open, setOpen] = useState<string | null>(plan.lines.find(l => l.group === 'day' && l.reason)?.key ?? null)
  const [why, setWhy] = useState(false)
  const shown = useCountUp(hero ? Number(hero.value.replace(/,/g, '')) : 0)
  const toggle = (k: string) => setOpen(o => (o === k ? null : k))

  return (
    <main className="question">
      <div className="plan-top">
        <BackButton onClick={onBack} />
        <button className="plan-edit" onClick={onEdit}>Edit</button>
      </div>
      <p className="question__section">Your plan</p>
      <h1 className="question__title">{titleFor(answers)}</h1>

      {hero && (
        <div className="plan-hero">
          <p className="plan-hero__pre">Eat about</p>
          <p className="plan-hero__num">{shown.toLocaleString('en-IN')}</p>
          <p className="plan-hero__unit">
            calories a day
            {hero.reason && <button className="plan-why" aria-expanded={why} onClick={() => setWhy(w => !w)}>Why?</button>}
          </p>
          {why && <p className="plan-hero__reason">{hero.reason}</p>}
        </div>
      )}

      {(['day', 'week'] as const).map((g, gi) => (
        <section key={g}>
          <p className="plan-group">{g === 'day' ? 'Each day' : 'Each week'}</p>
          <ul className="plan-list">
            {plan.lines.filter(l => l.group === g).map((l, i) => (
              <Row key={l.key} line={l} open={open === l.key} onToggle={() => toggle(l.key)} delay={(gi * 3 + i) * 80 + 300} />
            ))}
          </ul>
        </section>
      ))}

      {plan.notes.length > 0 && <div className="plan-notes">{plan.notes.map(n => <p key={n} className="answer-note">{n}</p>)}</div>}

      <div className="question__footer">
        <button className="button" onClick={onSave}>Save my plan</button>
        <p className="plan-footnote">We'll only ask for your email.</p>
      </div>
    </main>
  )
}

function Row({ line, open, onToggle, delay }: { line: PlanLine; open: boolean; onToggle: () => void; delay: number }) {
  const icon: IconName = line.key === 'move' ? (line.label === 'Strength' ? 'barbell' : 'person-simple-run') : icons[line.key]
  return (
    <li className="plan-row" data-open={open} style={{ '--d': `${delay}ms` } as CSSProperties}>
      <button className="plan-row__button" onClick={onToggle} disabled={!line.reason} aria-expanded={open}>
        <span className="plan-row__icon"><I name={icon} /></span>
        <span className="plan-row__label">{line.label}</span>
        <span className="plan-row__value">{line.value}</span>
      </button>
      {open && line.reason && <p className="plan-row__reason">{line.reason}</p>}
    </li>
  )
}

/** Counts up from 0 when the plan opens. */
function useCountUp(target: number, ms = 900) {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [value, setValue] = useState(reduce ? target : 0)
  const raf = useRef(0)
  useEffect(() => {
    if (reduce) { setValue(target); return }
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3)) / 10) * 10 || 0)
      if (p < 1) raf.current = requestAnimationFrame(tick)
      else setValue(target)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, ms, reduce])
  return value
}
