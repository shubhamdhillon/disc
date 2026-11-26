import type { CSSProperties } from 'react'
import BackButton from '../components/BackButton'
import type { Answers } from '../onboarding/answers'
import { buildPlan } from '../onboarding/plan'

/* The end of setup: the Plan, each number with its reason. Saving it is
   where the account comes in. */
export default function PlanReveal({ answers, onBack, onSave }: {
  answers: Answers
  onBack: () => void
  onSave: () => void
}) {
  const plan = buildPlan(answers)
  const own = answers.path === 'own'
  return (
    <main className="question">
      <div className="question__top"><BackButton onClick={onBack} /></div>
      <p className="question__section">Your plan</p>
      <h1 className="question__title">{own ? "Here's your plan" : "Here's where we start"}</h1>
      <p className="question__help">
        {own ? "Your numbers, in one place. Change any of them whenever you like."
             : "Built from your answers. Nothing's fixed. Change anything, anytime, and we'll adjust after week one too."}
      </p>
      <div className="plan-list">
        {plan.lines.map((l, i) => (
          <div key={l.key} className="plan-card" style={{ '--d': `${i * 90}ms` } as CSSProperties}>
            <div className="plan-card__top">
              <span className="plan-card__label">{l.label}</span>
              <span className="plan-card__value">{l.value}</span>
            </div>
            {l.reason && <p className="plan-card__reason">{l.reason}</p>}
          </div>
        ))}
      </div>
      {plan.notes.map(n => <p key={n} className="answer-note">{n}</p>)}
      <div className="question__footer">
        <button className="button" onClick={onSave}>Save my plan</button>
        <p className="field-note" style={{ textAlign: 'center', marginTop: 12 }}>Just your email, so your plan is safe if you switch phones.</p>
      </div>
    </main>
  )
}
