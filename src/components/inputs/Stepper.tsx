/** A number with − and + buttons, for numbers the user already knows. */
export default function Stepper({ value, onChange, step, min, max, unit }: {
  value: number
  onChange: (v: number) => void
  step: number
  min: number
  max: number
  unit: string
}) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)))
  return (
    <div className="stepper">
      <button type="button" className="stepper__btn" aria-label={`Less, by ${step}`} onClick={() => set(value - step)}>−</button>
      <div className="stepper__value">
        {/* The hidden copy sizes the box to the number, so it never gets cut off */}
        <span className="stepper__fit">
          <span className="stepper__mirror" aria-hidden="true">{value.toLocaleString('en-IN')}</span>
          <input
          inputMode="numeric"
            size={1}
          value={value.toLocaleString('en-IN')}
          onChange={e => {
            const n = Number(e.target.value.replace(/\D/g, ''))
            if (!Number.isNaN(n)) onChange(Math.min(max, n))
          }}
          onBlur={() => set(value)}
            aria-label={unit}
          />
        </span>
        <span className="stepper__unit">{unit}</span>
      </div>
      <button type="button" className="stepper__btn" aria-label={`More, by ${step}`} onClick={() => set(value + step)}>+</button>
    </div>
  )
}
