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
        <input
          inputMode="numeric"
          value={value.toLocaleString('en-IN')}
          onChange={e => {
            const n = Number(e.target.value.replace(/\D/g, ''))
            if (!Number.isNaN(n)) onChange(Math.min(max, n))
          }}
          onBlur={() => set(value)}
          aria-label={unit}
          style={{ width: `${value.toLocaleString('en-IN').length + 0.4}ch` }}
        />
        <span>{unit}</span>
      </div>
      <button type="button" className="stepper__btn" aria-label={`More, by ${step}`} onClick={() => set(value + step)}>+</button>
    </div>
  )
}
