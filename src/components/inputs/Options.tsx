import type { ReactNode } from 'react'
import { Tick } from '../icons'

export interface Option<T extends string> { value: T; label: string; hint?: string; icon?: ReactNode; art?: ReactNode }

/** Toggle a value in a multi-choice list. `exclusive` values clear everything else. */
export function toggle<T extends string>(list: T[], v: T, exclusive: T[] = []): T[] {
  if (list.includes(v)) return list.filter(x => x !== v)
  if (exclusive.includes(v)) return [v]
  return [...list.filter(x => !exclusive.includes(x)), v]
}

/** Answers as full-width rows: for longer labels or more than four choices.
    Single choice shows a tick only on the picked row; `multi` shows a box on every row. */
export function OptionRows<T extends string>({ options, selected, onPick, multi = false }: {
  options: Option<T>[]
  selected: T[]
  onPick: (v: T) => void
  multi?: boolean
}) {
  return (
    <div className="option-rows">
      {options.map(o => (
        <button key={o.value} type="button" className="option-row" aria-pressed={selected.includes(o.value)} onClick={() => onPick(o.value)}>
          {o.icon && <span className="option-row__icon">{o.icon}</span>}
          <span className="option-row__text">
            <span className="option-row__label">{o.label}</span>
            {o.hint && <span className="option-row__hint">{o.hint}</span>}
          </span>
          {multi
            ? <span className="option-row__box"><Tick /></span>
            : <span className="option-row__tick"><Tick /></span>}
        </button>
      ))}
    </div>
  )
}

/** Answers as tiles in a 2-column grid: for two to four short choices. */
export function OptionTiles<T extends string>({ options, selected, onPick }: {
  options: Option<T>[]
  selected: T[]
  onPick: (v: T) => void
}) {
  return (
    <div className="option-grid">
      {options.map(o => (
        <button key={o.value} type="button" className="option-tile" aria-pressed={selected.includes(o.value)} onClick={() => onPick(o.value)}>
          {o.icon && <span className="option-tile__art">{o.icon}</span>}
          {o.art}
          <span className="option-tile__label">{o.label}</span>
          {o.hint && <span className="option-tile__hint">{o.hint}</span>}
          <span className="option-tile__tick"><Tick /></span>
        </button>
      ))}
    </div>
  )
}

/** Small pill choices, for optional extras. */
export function Chips<T extends string>({ options, selected, onPick }: {
  options: Option<T>[]
  selected: T[]
  onPick: (v: T) => void
}) {
  return (
    <div className="chips">
      {options.map(o => (
        <button key={o.value} type="button" className="chip-option" aria-pressed={selected.includes(o.value)} onClick={() => onPick(o.value)}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  )
}
