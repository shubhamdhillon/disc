import { useRef, useState } from 'react'
import { OptionRows } from './inputs/Options'
import { readPlan, ReadPlanError } from '../lib/readPlan'
import type { Answers } from '../onboarding/answers'

/* "Yes, I'll add mine": upload a photo or PDF of the plan, or type the numbers. */
export default function PlanUpload({ a, set }: { a: Answers; set: (p: Partial<Answers>) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<'idle' | 'reading' | 'error'>('idle')
  const [error, setError] = useState('')

  async function onFile(file: File | undefined) {
    if (!file) return
    setState('reading')
    try {
      const r = await readPlan(file)
      if (r.notAPlan || (!r.calories && !r.protein && r.workoutDays === undefined)) {
        setState('error')
        setError("We couldn't find any plan numbers in that. Try another page, or type them in.")
        return
      }
      const found: string[] = []
      if (r.calories) found.push(`${r.calories.toLocaleString('en-IN')} calories a day`)
      if (r.protein) found.push(`${r.protein} g protein a day`)
      if (r.workoutDays !== undefined) found.push(`${r.workoutDays} workout days a week`)
      if (r.waterMl) found.push(`${(r.waterMl / 1000).toFixed(1).replace('.0', '')} L water a day`)
      set({
        planSource: 'upload',
        planFound: { summary: r.summary, estimated: r.estimated, found },
        ...(r.calories ? { myCalories: r.calories } : {}),
        ...(r.protein ? { myProtein: r.protein } : {}),
        ...(r.workoutDays !== undefined ? { myWorkoutDays: r.workoutDays } : {}),
        ...(r.waterMl ? { myWaterMl: r.waterMl } : {}),
      })
      setState('idle')
    } catch (e) {
      setState('error')
      setError(e instanceof ReadPlanError ? e.message : "We couldn't read that one. Try again, or type the numbers in.")
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  return (
    <>
      <OptionRows<'upload' | 'type'>
        options={[
          { value: 'upload', label: 'Upload a photo or PDF', hint: "We'll pick out the numbers for you" },
          { value: 'type', label: "I'll type the numbers" },
        ]}
        selected={a.planSource ? [a.planSource] : []}
        onPick={v => {
          if (v === 'type') { set({ planSource: 'type', planFound: undefined }); setState('idle'); return }
          input.current?.click()
        }}
      />
      <input ref={input} type="file" accept="image/*,application/pdf" hidden onChange={e => onFile(e.target.files?.[0])} />

      {state === 'reading' && <p className="upload-reading"><i aria-hidden="true" />Reading your plan…</p>}
      {state === 'error' && <p className="answer-note answer-note--warn" role="alert">{error}</p>}
      {state === 'idle' && a.planSource === 'upload' && a.planFound && (
        <div className="upload-found">
          <p className="upload-found__title">Here's what we found</p>
          {a.planFound.summary && <p className="field-note" style={{ paddingLeft: 0 }}>{a.planFound.summary}</p>}
          <ul>{a.planFound.found.map(f => <li key={f}>{f}</li>)}</ul>
          <p className="field-note" style={{ paddingLeft: 0, marginTop: 10 }}>
            {a.planFound.estimated ? 'Your plan lists meals, not totals, so these are our estimate. ' : ''}
            You can check and change everything next.
          </p>
        </div>
      )}
      {a.planSource !== 'type' && state !== 'reading' && (
        <p className="field-note" style={{ marginTop: 14 }}>Google's Gemini AI reads the file to find the numbers. Disc doesn't keep the file.</p>
      )}
    </>
  )
}
