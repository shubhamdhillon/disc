import { useState, useRef, useEffect, useLayoutEffect } from 'react'

const BRAND_GREEN = '#1C7C2E'

// ── Layout constants ───────────────────────────────────────────────────────────
// VISIBLE=3 matches the design: one faded item above, the selected item in the
// center, one faded item below. Items at distance ≥2 are outside the clipped
// container and therefore invisible.
export const ITEM_H      = 36
export const VISIBLE     = 3
export const CONTAINER_H = ITEM_H * VISIBLE      // 108 px
export const PAD         = (CONTAINER_H - ITEM_H) / 2  // 36 px

// Visual style per distance from the selected center row.
// distance 0 = selected (large, green, bold)
// distance 1 = adjacent (faded grey)
// distance 2+ = outside the clipped container; kept for scroll-calculation safety
const DIST: { opacity: number; size: string; weight: string; color: string }[] = [
  { opacity: 1,    size: '20px', weight: '700', color: BRAND_GREEN },
  { opacity: 0.38, size: '15px', weight: '400', color: '#9ca3af'   },
  { opacity: 0.12, size: '13px', weight: '400', color: '#c4c4c4'   },
  { opacity: 0.05, size: '12px', weight: '400', color: '#d1d5db'   },
]

interface WheelPickerProps {
  values:       (string | number)[]
  defaultIndex?: number
  /** Fires with the new index ~60 ms after the user stops scrolling */
  onChange:     (index: number) => void
  /** Column label shown above the drum. Pass an empty string to hide it. */
  label?:       string
}

export default function WheelPicker({
  values,
  defaultIndex = 0,
  onChange,
  label = '',
}: WheelPickerProps) {
  const clamp = (n: number) => Math.max(0, Math.min(n, values.length - 1))
  const init  = clamp(defaultIndex)

  const [activeIdx, setActiveIdx] = useState(init)
  const activeRef   = useRef(init)
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const containerRef = useRef<HTMLDivElement>(null)

  // ── Set initial scroll position before first paint ─────────────────────────
  useLayoutEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = init * ITEM_H
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll listener ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let rafId  = -1
    let debounce: ReturnType<typeof setTimeout>

    const onScroll = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const idx = clamp(Math.round(el.scrollTop / ITEM_H))

        if (idx !== activeRef.current) {
          activeRef.current = idx
          setActiveIdx(idx)
          try { navigator.vibrate(10) } catch (_) { /* no-op */ }
          clearTimeout(debounce)
          debounce = setTimeout(() => {
            onChangeRef.current(idx)
          }, 60)
        }
      })
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(rafId)
      clearTimeout(debounce)
    }
  }, [values]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center">
      {/* Column label — hidden when label prop is empty */}
      {label ? (
        <span className="block pt-2.5 pb-1 text-[12px] font-medium text-gray-400">
          {label}
        </span>
      ) : (
        // Spacer keeps alignment consistent with labelled pickers in the same row
        <span className="block pt-2.5 pb-1 text-[12px]">&nbsp;</span>
      )}

      {/* Scrollable drum — no decorative center lines, just fading opacity */}
      <div
        ref={containerRef}
        style={{
          height:                 CONTAINER_H,
          paddingTop:             PAD,
          paddingBottom:          PAD,
          overflowY:              'scroll',
          scrollSnapType:         'y mandatory',
          scrollbarWidth:         'none',
          WebkitOverflowScrolling:'touch',
        }}
        className="w-full [&::-webkit-scrollbar]:hidden"
      >
        {values.map((v, i) => {
          const d = Math.min(Math.abs(i - activeIdx), DIST.length - 1)
          const s = DIST[d]
          return (
            <div
              key={i}
              style={{
                height:         ITEM_H,
                scrollSnapAlign:'center',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                cursor:         'pointer',
                userSelect:     'none',
                opacity:        s.opacity,
                fontSize:       s.size,
                fontWeight:     s.weight,
                color:          s.color,
              }}
              onClick={() =>
                containerRef.current?.scrollTo({ top: i * ITEM_H, behavior: 'smooth' })
              }
            >
              {v}
            </div>
          )
        })}
      </div>
    </div>
  )
}
