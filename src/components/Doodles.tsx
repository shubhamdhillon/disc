import type { CSSProperties } from 'react'

/*
  Line doodles for the welcome screen, grouped by size:
  the bowl in the middle is biggest, bottle and dumbbell medium, the rest small.
  Each one draws itself in; --d staggers them.
*/

const at = (left: number, top: number, w: number, h: number, rot: number, delay: number): CSSProperties =>
  ({ left, top, width: w, height: h, transform: `rotate(${rot}deg)`, '--d': `${delay}ms` } as CSSProperties)

export default function Doodles() {
  return (
    <div className="welcome__doodles" aria-hidden="true">
      {/* bowl, biggest */}
      <svg style={at(105, 30, 90, 84, 0, 300)} viewBox="0 0 90 84">
        <path pathLength={1} d="M6 44h78c0 20-17 32-39 32S6 64 6 44z" />
        <path pathLength={1} d="M30 32c-5-6 5-9 0-17M45 32c-5-6 5-9 0-17M60 32c-5-6 5-9 0-17" />
      </svg>
      {/* water bottle */}
      <svg style={at(40, 36, 44, 84, -10, 420)} viewBox="0 0 44 84">
        <rect pathLength={1} x="15" y="3" width="14" height="9" rx="3" />
        <path pathLength={1} d="M13 12h18l4 9v54a5 5 0 0 1-5 5H14a5 5 0 0 1-5-5V21z" />
        <path pathLength={1} d="M9 40h26M9 54h26" />
      </svg>
      {/* dumbbell */}
      <svg style={at(212, 52, 72, 40, 12, 480)} viewBox="0 0 72 40">
        <rect pathLength={1} x="4" y="8" width="9" height="24" rx="3" />
        <rect pathLength={1} x="15" y="12" width="6" height="16" rx="2" />
        <rect pathLength={1} x="59" y="8" width="9" height="24" rx="3" />
        <rect pathLength={1} x="51" y="12" width="6" height="16" rx="2" />
        <line pathLength={1} x1="21" y1="20" x2="51" y2="20" />
      </svg>
      {/* apple */}
      <svg style={at(0, 96, 40, 40, -14, 560)} viewBox="0 0 40 40">
        <path pathLength={1} d="M20 12c-4-4-14-2-14 9 0 9 7 16 12 15 1-1 3-1 4 0 5 1 12-6 12-15 0-11-10-13-14-9z" />
        <path pathLength={1} d="M20 12c0-4 2-6 5-7" />
      </svg>
      {/* leaf */}
      <svg style={at(258, 4, 38, 40, 18, 600)} viewBox="0 0 38 40">
        <path pathLength={1} d="M6 36C9 20 18 9 32 4c-1 14-10 25-26 32z" />
        <path pathLength={1} d="M8 34c7-9 13-17 20-26" />
      </svg>
      {/* sneaker */}
      <svg style={at(260, 104, 46, 30, -8, 640)} viewBox="0 0 46 30">
        <path pathLength={1} d="M4 22c0-7 2-13 6-15l7 5c5 3 11 5 19 6 7 1 8 3 8 7v2H4z" />
        <path pathLength={1} d="M4 27h40" />
        <path pathLength={1} d="M17 13l3-3M22 16l3-3" />
      </svg>
      {/* chai cup */}
      <svg style={at(16, 6, 38, 34, 8, 680)} viewBox="0 0 38 34">
        <path pathLength={1} d="M4 8h24l-3 21a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3z" />
        <path pathLength={1} d="M28 12c7 0 7 10 0 10" />
      </svg>
    </div>
  )
}
