import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const ROW = 44

/** iPhone-style scroll wheel. Five rows visible, the middle one is the pick. */
export default function Wheel<T>({ values, value, format, onChange, label }: {
  values: T[]
  value: T
  format: (v: T) => string
  onChange: (v: T) => void
  label?: string
}) {
  const el = useRef<HTMLDivElement>(null)
  const start = Math.max(0, values.indexOf(value))
  const [active, setActive] = useState(start)
  const change = useRef(onChange)
  const list = useRef(values)
  useEffect(() => { change.current = onChange; list.current = values })

  useLayoutEffect(() => {
    if (el.current) el.current.scrollTop = start * ROW
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const node = el.current
    if (!node) return
    let frame = 0
    let settle: ReturnType<typeof setTimeout>
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const vals = list.current
        const i = Math.max(0, Math.min(vals.length - 1, Math.round(node.scrollTop / ROW)))
        setActive(prev => {
          if (prev !== i) { try { navigator.vibrate?.(8) } catch { /* not supported */ } }
          return i
        })
        clearTimeout(settle)
        settle = setTimeout(() => change.current(vals[i]), 80)
      })
    }
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => { node.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); clearTimeout(settle) }
    // Subscribed once: callers pass a fresh values array on every render, and
    // re-subscribing would cancel the pending "settled" call mid-scroll.
  }, [])

  return (
    <div className="wheel">
      {label && <span className="wheel__label">{label}</span>}
      <div className="wheel__window">
        <div className="wheel__band" aria-hidden="true" />
        <div className="wheel__scroll" ref={el} role="listbox" aria-label={label}>
          {values.map((v, i) => (
            <div
              key={i}
              role="option"
              aria-selected={i === active}
              className="wheel__item"
              data-distance={Math.min(Math.abs(i - active), 3)}
              onClick={() => el.current?.scrollTo({ top: i * ROW, behavior: 'smooth' })}
            >
              {format(v)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export const range = (from: number, to: number, step = 1) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => +(from + i * step).toFixed(1))
