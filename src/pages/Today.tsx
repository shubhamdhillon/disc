import { useState, useRef, useMemo, useEffect, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion, useMotionValue, animate } from 'framer-motion'
import AddMealSheet from '../components/AddMealSheet'
import QualityIcons from '../components/QualityIcons'
import {
  getTodaysMeals,
  sumMacros,
  formatMealTime,
  removeMeal,
  restoreMeal,
  type LoggedMeal,
} from '../lib/mealsStore'
import { getWeekRecords, type DailyRecord } from '../lib/dailyRecords'
import { fetchTargets, type Targets } from '../lib/targetsStore'
import { fetchName, saveName, getCachedName } from '../lib/profileStore'
import { computeDayVerdict, type DayVerdict } from '../lib/dayVerdict'
import { supabase } from '../lib/supabase'
import { TriangleAlert, Siren } from 'lucide-react'

const BRAND_GREEN = '#1C7C2E'
const TERRACOTTA  = '#C4623D'
const UNDER_BLUE  = '#5B7A99'
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

// ─── Day zone (pure, derived each render — never persisted) ───────────────────
export type DayZone = 'fresh' | 'building' | 'closing' | 'landed' | 'over' | 'under'

/**
 * Derive the day's calorie zone from consumed/target ratio and clock time.
 * 'under' only kicks in at/after 21:00 so a low morning total isn't scolded.
 */
export function computeDayZone(
  consumedCals: number,
  targetCals: number,
  now: Date,
): DayZone {
  const ratio = targetCals > 0 ? consumedCals / targetCals : 0

  if (ratio > 1.10) return 'over'
  if (ratio > 0.95) return 'landed'   // 0.95 < ratio ≤ 1.10
  if (ratio > 0.70) return 'closing'  // 0.70 < ratio ≤ 0.95
  // Late-day under takes precedence over fresh/building when still below 70%
  if (ratio < 0.70 && now.getHours() >= 21) return 'under'
  if (consumedCals === 0) return 'fresh'
  return 'building'                   // 0 < ratio ≤ 0.70
}

interface ZoneVisual {
  accent:       string
  border:       string
  glowRgb:      string
  glowStrength: number
  /** Soft idle pulse on the glow overlay (skipped under reduced motion) */
  pulse:        boolean
  /** Landed keeps glow at full opacity instead of pulsing */
  glowFull:     boolean
}

const ZONE_VISUAL: Record<DayZone, ZoneVisual> = {
  fresh: {
    accent: BRAND_GREEN,
    border: 'rgba(28,124,46,0.18)',
    glowRgb: '28,124,46',
    glowStrength: 0.04,
    pulse: false,
    glowFull: false,
  },
  building: {
    accent: BRAND_GREEN,
    border: 'rgba(28,124,46,0.22)',
    glowRgb: '28,124,46',
    glowStrength: 0.07,
    pulse: true,
    glowFull: false,
  },
  closing: {
    accent: '#145A24',
    border: 'rgba(20,90,36,0.35)',
    glowRgb: '20,90,36',
    glowStrength: 0.11,
    pulse: true,
    glowFull: false,
  },
  landed: {
    accent: '#0D5C1A',
    border: 'rgba(13,92,26,0.50)',
    glowRgb: '13,92,26',
    glowStrength: 0.18,
    pulse: false,
    glowFull: true,
  },
  over: {
    accent: TERRACOTTA,
    border: 'rgba(196,98,61,0.40)',
    glowRgb: '196,98,61',
    glowStrength: 0.10,
    pulse: false,
    glowFull: false,
  },
  under: {
    accent: UNDER_BLUE,
    border: 'rgba(91,122,153,0.35)',
    glowRgb: '91,122,153',
    glowStrength: 0.08,
    pulse: false,
    glowFull: false,
  },
}

interface ZoneDisplay {
  number:      number
  sublabel:    string
  copy:        string | null
  numberColor: string
  /** Show the inline "cal" unit next to the big number */
  showCalUnit: boolean
}

function zoneDisplay(zone: DayZone, consumed: number, target: number): ZoneDisplay {
  const remaining = Math.max(0, target - consumed)
  const overage   = consumed - target
  const deficit   = target - consumed
  const accent    = ZONE_VISUAL[zone].accent

  switch (zone) {
    case 'fresh':
      return {
        number: target,
        sublabel: 'cal for today',
        copy: null,
        numberColor: '#111827',
        showCalUnit: false,
      }
    case 'building':
      return {
        number: remaining,
        sublabel: `left of ${target.toLocaleString()}`,
        copy: null,
        numberColor: '#111827',
        showCalUnit: true,
      }
    case 'closing':
      return {
        number: remaining,
        sublabel: `left of ${target.toLocaleString()}`,
        copy: `Almost there — ${remaining} to go`,
        numberColor: '#111827',
        showCalUnit: true,
      }
    case 'landed':
      return {
        number: remaining,
        sublabel: `left of ${target.toLocaleString()}`,
        copy: 'Right on target. Good day',
        numberColor: '#111827',
        showCalUnit: true,
      }
    case 'over':
      return {
        number: overage,
        sublabel: 'Over today',
        copy: `${overage} Over today.`,
        numberColor: accent,
        showCalUnit: true,
      }
    case 'under':
      return {
        number: deficit,
        sublabel: 'Under target',
        copy: `You're ${deficit} under, eat something`,
        numberColor: accent,
        showCalUnit: true,
      }
  }
}

/** Evenly spaced rim positions; count grows with meals beyond the base 6. */
function katoriPositions(count: number): { top: string; left: string }[] {
  const radius = 37
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / count
    return {
      top:  `${50 + radius * Math.sin(angle)}%`,
      left: `${50 + radius * Math.cos(angle)}%`,
    }
  })
}

/** Shrink bowls slightly once we exceed the base 6 so they still fit. */
function katoriSizePx(count: number): number {
  if (count <= 6) return 48
  return Math.max(28, Math.round(48 - (count - 6) * 2.5))
}

// ─── CountUp component ────────────────────────────────────────────────────────
// Renders an animated number by writing directly to the DOM via a ref — zero
// React re-renders during the animation. Uses Framer Motion's animate() with a
// MotionValue so the engine handles RAF scheduling and cancellation.
//
// Props:
//   locale  – format with toLocaleString() (used for the calories center number)
//   className / style – forwarded to the rendered <span>
interface CountUpProps {
  target:     number
  duration:   number
  reduced:    boolean
  locale?:    boolean
  className?: string
  style?:     React.CSSProperties
}

function CountUp({ target, duration, reduced, locale = false, className, style }: CountUpProps) {
  const nodeRef    = useRef<HTMLSpanElement>(null)
  const mv         = useMotionValue(target)         // seeded with initial value
  const animRef    = useRef<{ stop(): void } | null>(null)
  const mountedRef = useRef(false)

  // Write initial text before first paint (synchronous, no flicker)
  useLayoutEffect(() => {
    if (nodeRef.current) {
      nodeRef.current.textContent = locale ? target.toLocaleString() : String(target)
    }
  }, [])   // intentionally runs once

  useEffect(() => {
    const node = nodeRef.current
    if (!node) return

    // Skip on first run — useLayoutEffect already set the initial value
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }

    animRef.current?.stop()

    if (reduced) {
      mv.set(target)
      node.textContent = locale ? target.toLocaleString() : String(target)
      return
    }

    animRef.current = animate(mv, target, {
      duration: duration / 1000,
      ease: (t: number) => 1 - Math.pow(1 - t, 3),   // cubic ease-out, matches previous hook
      onUpdate: (v: number) => {
        if (nodeRef.current) {
          nodeRef.current.textContent = locale
            ? Math.round(v).toLocaleString()
            : String(Math.round(v))
        }
      },
    })

    return () => animRef.current?.stop()
  }, [target])   // re-run only when target changes

  // Empty span — textContent managed entirely via direct DOM writes above
  return <span ref={nodeRef} className={className} style={style} />
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function AvatarIcon() {
  return (
    <img
      src="/avatar.png"
      alt=""
      width={40}
      height={40}
      className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
      style={{ border: '1px solid rgba(0,0,0,0.06)' }}
    />
  )
}

function HistoryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}

// ─── Name prompt ──────────────────────────────────────────────────────────────
function NamePrompt({ onSave }: { onSave: (n: string) => void }) {
  const [val, setVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = () => {
    const trimmed = val.trim()
    if (trimmed) onSave(trimmed)
  }

  return (
    <motion.div
      className="rounded-2xl bg-green-50 px-4 py-4"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <p className="mb-2.5 text-[13px] font-semibold" style={{ color: BRAND_GREEN }}>
        What should we call you?
      </p>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          autoFocus
          type="text"
          placeholder="Your name…"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && commit()}
          className="min-w-0 flex-1 rounded-xl border border-green-200 bg-white px-3 py-2 text-[14px] text-gray-800 outline-none placeholder:text-gray-300 focus:border-green-400"
        />
        <button
          type="button"
          onClick={commit}
          disabled={!val.trim()}
          className="rounded-xl px-4 py-2 text-[14px] font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ backgroundColor: BRAND_GREEN }}
        >
          Save
        </button>
      </div>
    </motion.div>
  )
}

// ─── Macro strip ──────────────────────────────────────────────────────────────
const AXIS_BAR_COLOR = {
  bad:  '#E11D48',
  warn: '#E0A94A',
} as const

function MacroStrip({
  targets, consumed, dayName: _dayName, mealsCount: _mealsCount, reduced, verdict,
}: {
  targets:    Targets
  consumed:   Targets
  dayName:    string
  mealsCount: number
  reduced:    boolean
  verdict:    DayVerdict
}) {
  // Width stays capped at 100%; protein/fat color comes from axis status
  const pPct = Math.min((consumed.protein / targets.protein) * 100, 100)
  const cPct = Math.min((consumed.carbs   / targets.carbs)   * 100, 100)
  const fPct = Math.min((consumed.fat     / targets.fat)     * 100, 100)

  const barT = reduced
    ? { duration: 0 }
    : { duration: 0.6, ease: 'easeOut' as const }

  const columns: {
    key:      string
    label:    string
    value:    number
    target:   number
    pct:      number
    /** Status color for protein/fat; null = always green gradient (carbs) */
    statusColor: string | null
    gradient: string
  }[] = [
    {
      key: 'protein', label: 'Protein',
      value: consumed.protein, target: targets.protein, pct: pPct,
      statusColor: verdict.protein === 'fine' ? null : AXIS_BAR_COLOR[verdict.protein],
      gradient: 'linear-gradient(90deg, #1C7C2E 0%, #34A048 100%)',
    },
    {
      key: 'carbs', label: 'Carbs',
      value: consumed.carbs, target: targets.carbs, pct: cPct,
      statusColor: null, // carbs never status-colored
      gradient: 'linear-gradient(90deg, #6FA82F 0%, #8FC44A 100%)',
    },
    {
      key: 'fat', label: 'Fat',
      value: consumed.fat, target: targets.fat, pct: fPct,
      statusColor: verdict.fat === 'fine' ? null : AXIS_BAR_COLOR[verdict.fat],
      gradient: 'linear-gradient(90deg, #A6CF77 0%, #C2E29A 100%)',
    },
  ]

  return (
    <div
      className="rounded-2xl"
      style={{
        backgroundColor: '#FFFFFF',
        padding: '16px',
        border: '1px solid #EEF0EE',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      <div className="flex gap-4">
        {columns.map(col => (
          <div key={col.key} className="flex min-w-0 flex-1 flex-col items-center text-center">
            <div className="flex items-baseline justify-center gap-0.5">
              <CountUp
                target={col.value}
                duration={600}
                reduced={reduced}
                className="text-[15px] font-semibold leading-none"
                style={{ color: col.statusColor ?? '#1A1A1A' }}
              />
              <span className="text-[11px]" style={{ color: '#AEB4AE' }}>
                /{col.target}g
              </span>
            </div>
            <p className="mt-[5px] text-[10px]" style={{ color: '#9AA39C' }}>
              {col.label}
            </p>
            <div
              className="mt-[5px] overflow-hidden rounded-full"
              style={{ width: 64, height: 6, backgroundColor: '#EDEFED' }}
            >
              <motion.div
                className="h-full rounded-full"
                initial={false}
                animate={{ width: `${col.pct}%` }}
                transition={barT}
                style={{
                  background: col.statusColor ?? col.gradient,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Thali ────────────────────────────────────────────────────────────────────
type MealTier = 'green' | 'amber' | 'red'

function mealTier(meal: LoggedMeal): MealTier {
  const tags = meal.quality ?? []
  if (tags.includes('sugary') || tags.includes('fried')) return 'red'
  if (tags.includes('whole')) return 'green'
  return 'amber'
}

const TIER_KATORI: Record<MealTier, { fill: string; ring: string; number: string }> = {
  green: { fill: '#DCEFDF', ring: '#3A9E4B', number: '#2E7D3E' },
  amber: { fill: '#FBEFD6', ring: '#E0A94A', number: '#B9822E' },
  red:   { fill: '#FADCDC', ring: '#D96A6A', number: '#C45A5A' },
}

const VERDICT_GLOW = {
  good: { inner: '5,150,105',  outer: '132,204,22' },
  warn: { inner: '217,119,6',  outer: '225,113,80' },
  bad:  { inner: '225,29,72',  outer: '159,18,110' },
} as const

function Thali({
  display, meals, newlyFilledIdx, reduced, verdict,
}: {
  display:         ZoneDisplay
  meals:           LoggedMeal[]
  newlyFilledIdx:  number | null
  reduced:         boolean
  verdict:         DayVerdict
}) {
  // Chronological: oldest first so the first meal fills the first katori
  const chronoMeals = useMemo(
    () => [...meals].sort((a, b) => a.timestamp - b.timestamp),
    [meals],
  )
  const filledCount = chronoMeals.length
  // Always at least 6 rim slots; grow so every logged meal has a bowl
  const slotCount = Math.max(6, filledCount)
  const positions = katoriPositions(slotCount)
  const sizePx    = katoriSizePx(slotCount)
  const showCal   = sizePx >= 34

  const g = VERDICT_GLOW[verdict.overall]

  const emptyBorder = '1.5px dashed #D1D5DB'

  // Glow breath rhythm — slower is calmer
  const BREATH = {
    good: { a: 7.0, b: 9.0 },
    warn: { a: 5.0, b: 6.5 },
    bad:  { a: 3.6, b: 4.8 },
  } as const
  const breath = BREATH[verdict.overall]

  return (
    <div className="flex flex-col items-center py-8">
      <div className="relative aspect-square w-full max-w-[230px]">
        {/* Nebula layers — breathing glow behind opaque plate */}
        <motion.div
          key={`nebula-1-${verdict.overall}`}
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full"
          style={{
            inset: '-8%',
            zIndex: 0,
            filter: 'blur(26px)',
            background: `radial-gradient(circle at 46% 42%, rgba(${g.outer},0.55) 0%, transparent 66%)`,
          }}
          animate={
            reduced
              ? { scale: 1, opacity: 0.7 }
              : { scale: [0.94, 1.10, 0.94], opacity: [0.45, 1, 0.45] }
          }
          transition={
            reduced
              ? { duration: 0 }
              : { duration: breath.a, repeat: Infinity, ease: [0.37, 0, 0.63, 1], times: [0, 0.42, 1] }
          }
        />
        <motion.div
          key={`nebula-2-${verdict.overall}`}
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full"
          style={{
            inset: '-3%',
            zIndex: 0,
            filter: 'blur(16px)',
            background: `radial-gradient(circle at 56% 58%, rgba(${g.inner},0.42) 0%, transparent 60%)`,
          }}
          animate={
            reduced
              ? { scale: 1, opacity: 0.6 }
              : { scale: [1.02, 0.90, 1.02], opacity: [0.85, 0.35, 0.85] }
          }
          transition={
            reduced
              ? { duration: 0 }
              : { duration: breath.b, repeat: Infinity, ease: [0.37, 0, 0.63, 1], times: [0, 0.42, 1] }
          }
        />

        {/* Opaque plate surface — blocks glow from washing the face */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{
            zIndex: 1,
            backgroundColor: '#FDFDFC',
            border: '1px solid rgba(0,0,0,0.05)',
          }}
        />

        {/* Katoris + center — on top of the opaque surface */}
        <div className="absolute inset-0 z-[2] flex items-center justify-center rounded-full">
        {/* Katoris — outer div = position, inner motion.div = spring/fade */}
        {positions.map((pos, i) => {
          const meal          = chronoMeals[i]
          const isFilled      = !!meal
          const isNewlyFilled = i === newlyFilledIdx
          const isNew         = isNewlyFilled && !reduced
          const tier          = meal ? mealTier(meal) : null
          const colors        = tier ? TIER_KATORI[tier] : null

          const kInit = isNewlyFilled && reduced ? { opacity: 0 }
                      : isNew                   ? { scale: 0, opacity: 0 }
                      : false as const
          const kTransition = isNewlyFilled && reduced
            ? { duration: 0.15, ease: 'easeOut' as const }
            : isNew
              ? { type: 'spring' as const, stiffness: 300, damping: 20 }
              : { duration: 0 }

          return (
            <div
              key={`${slotCount}-${i}`}
              className="absolute"
              style={{ top: pos.top, left: pos.left, transform: 'translate(-50%,-50%)' }}
            >
              <AnimatePresence mode="wait">
                {isFilled && colors ? (
                  <motion.div
                    key={meal.id}
                    className="flex items-center justify-center rounded-full"
                    style={{
                      width: sizePx,
                      height: sizePx,
                      backgroundColor: colors.fill,
                      border: `1.5px solid ${colors.ring}`,
                    }}
                    initial={kInit}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={kTransition}
                  >
                    {showCal && (
                      <span
                        className="font-semibold leading-none"
                        style={{
                          fontSize: sizePx >= 42 ? 12 : 11,
                          color: colors.number,
                        }}
                      >
                        {meal.calories}
                      </span>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    className="rounded-full"
                    style={{ width: sizePx, height: sizePx, border: emptyBorder }}
                    initial={false}
                    animate={{ opacity: 1 }}
                  />
                )}
              </AnimatePresence>
            </div>
          )
        })}

        {/* Center number + sublabel */}
        <div className="z-10 flex flex-col items-center px-8">
          <p
            className="text-[32px] font-bold leading-none tracking-tight"
            style={{ color: display.numberColor }}
          >
            <CountUp
              target={display.number}
              duration={600}
              reduced={reduced}
              locale
              style={{ color: display.numberColor }}
            />
            {display.showCalUnit && (
              <span className="ml-1 text-[15px] font-medium text-gray-400">cal</span>
            )}
          </p>
          <p className="mt-1.5 text-[12px] text-gray-400">{display.sublabel}</p>
        </div>
        </div>
      </div>
    </div>
  )
}

// ─── Meal row ──────────────────────────────────────────────────────────────────
function MealRow({
  meal,
  onDelete,
}: {
  meal:     LoggedMeal
  onDelete: (meal: LoggedMeal) => void
}) {
  const [showDelete, setShowDelete] = useState(false)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setShowDelete(v => !v)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setShowDelete(v => !v)
        }
      }}
      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5"
    >
      <div className="h-9 w-9 flex-shrink-0 rounded-xl" style={{ backgroundColor: 'rgba(28,124,46,0.09)' }} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[14px] font-semibold text-gray-800">{meal.name}</p>
          <QualityIcons tags={meal.quality ?? []} size={14} />
        </div>
        <p className="mt-0.5 text-[12px] text-gray-400">{formatMealTime(meal.timestamp)}</p>
      </div>
      {showDelete ? (
        <button
          type="button"
          aria-label={`Delete ${meal.name}`}
          onClick={e => {
            e.stopPropagation()
            onDelete(meal)
          }}
          className="flex-shrink-0 rounded-xl px-3 py-2 text-[13px] font-semibold text-red-500"
        >
          Delete
        </button>
      ) : (
        <div className="flex-shrink-0 text-right">
          <p className="text-[14px] font-semibold text-gray-800">{meal.calories} cal</p>
          <p className="mt-0.5 text-[12px] text-gray-400">{meal.protein}g protein</p>
        </div>
      )}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyMeals() {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="mb-4 h-12 w-12 rounded-full" style={{ border: '2px dashed rgba(28,124,46,0.28)' }} />
      <p className="text-[14px] font-medium text-gray-500">Nothing here yet</p>
      <p className="mt-1 text-[13px] text-gray-400">Your first meal will appear here</p>
    </div>
  )
}

// ─── Mount entrance helper ────────────────────────────────────────────────────
function fadeUp(delay: number, reduced: boolean) {
  return {
    initial:    reduced ? false as const : { opacity: 0, y: 10 },
    animate:    { opacity: 1, y: 0 },
    transition: { delay, duration: 0.35, ease: 'easeOut' as const },
  }
}

// ─── 7-day week strip (Mon→Sun, ring-outline cells) ───────────────────────────
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const AMBER_RING  = '#E0A94A'
const AMBER_FILL  = 'transparent'
const AMBER_TEXT  = '#B9822E'
const HIT_FILL    = 'transparent'
const EMPTY_RING  = '#E8E8E6'
const LABEL_GREY  = '#B8BEB9'

function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseLocalDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function WeekStrip({ week }: { week: DailyRecord[] }) {
  const todayStr = toDateKey(new Date())

  return (
    <div className="flex w-full items-start justify-between bg-transparent">
      {week.map(record => {
        const d        = parseLocalDate(record.date)
        const letter   = DAY_LETTERS[d.getDay()]
        const dayNum   = d.getDate()
        const isToday  = record.date === todayStr
        const isFuture = record.date > todayStr
        const { verdict } = record

        let circleStyle: React.CSSProperties
        let numberColor: string

        if (isToday) {
          // Today overrides all other states — solid green, in progress
          circleStyle = { backgroundColor: BRAND_GREEN }
          numberColor = '#FFFFFF'
        } else if (isFuture) {
          circleStyle = {
            border: `1.5px solid ${EMPTY_RING}`,
            opacity: 0.5,
          }
          numberColor = '#D1D5DB' // gray-300
        } else if (verdict === 'good') {
          circleStyle = {
            border: `1.5px solid ${BRAND_GREEN}`,
            backgroundColor: HIT_FILL,
          }
          numberColor = BRAND_GREEN
        } else if (verdict === 'warn') {
          circleStyle = {
            border: `1.5px solid ${AMBER_RING}`,
            backgroundColor: AMBER_FILL,
          }
          numberColor = AMBER_TEXT
        } else if (verdict === 'bad') {
          circleStyle = {
            border: '1.5px solid #E11D48',
            backgroundColor: 'transparent',
          }
          numberColor = '#E11D48'
        } else {
          // empty past day (verdict === null)
          circleStyle = { border: `1.5px solid ${EMPTY_RING}` }
          numberColor = '#9CA3AF' // gray-400
        }

        return (
          <div key={record.date} className="flex flex-col items-center gap-1.5">
            <span
              className="text-[9px]"
              style={{
                color: isToday ? BRAND_GREEN : LABEL_GREY,
                fontWeight: isToday ? 600 : 400,
              }}
            >
              {letter}
            </span>
            <div
              className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[12px] font-semibold"
              style={{ ...circleStyle, color: numberColor }}
            >
              {dayNum}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Coach card ───────────────────────────────────────────────────────────────
function CoachCard({ coach }: { coach: DayVerdict['coach'] }) {
  if (coach.severity === 'good') {
    return (
      <p className="text-center text-[13px] leading-relaxed" style={{ color: '#6B7280' }}>
        {coach.body}
      </p>
    )
  }

  const isBad = coach.severity === 'bad'
  const accent = isBad ? '#E11D48' : '#D97706'
  const Icon = isBad ? Siren : TriangleAlert

  return (
    <div
      className="rounded-2xl"
        style={{
          backgroundColor: isBad ? '#FEF2F3' : '#FEF9F0',
          border: `1px solid ${isBad ? '#F9D5DA' : '#F5E3C4'}`,
          padding: '16px',
        }}
    >
      <div className="flex items-start gap-3">
        <Icon size={18} strokeWidth={2} color={accent} className="mt-[1px] flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-snug" style={{ color: accent }}>
            {coach.headline}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: '#4B5563' }}>
            {coach.body}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Today screen ─────────────────────────────────────────────────────────────
export default function Today() {
  const prefersReduced = useReducedMotion() ?? false
  const navigate       = useNavigate()
  const dayName        = WEEKDAYS[new Date().getDay()]
  const greeting       = getGreeting()

  const [name,          setName]          = useState<string | null>(null)
  const [sheetOpen,     setSheetOpen]     = useState(false)
  const [mealVersion,   setMealVersion]   = useState(0)
  // Which katori index just filled — drives the spring animation
  const [newKatoriIdx,  setNewKatoriIdx]  = useState<number | null>(null)
  // Shared undo toast for chip-log and row-delete
  const [undoToast, setUndoToast] = useState<
    { action: 'logged' | 'deleted'; meal: LoggedMeal } | null
  >(null)
  const undoTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const katoriTimerRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const [targetsState, setTargetsState] = useState<
    | { status: 'loading' }
    | { status: 'ok'; targets: Targets }
    | { status: 'missing' }
    | { status: 'error'; message: string }
  >({ status: 'loading' })

  const showUndoToast = (action: 'logged' | 'deleted', meal: LoggedMeal) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoToast({ action, meal })
    undoTimerRef.current = setTimeout(() => setUndoToast(null), 4000)
  }

  const handleSetName = async (n: string) => {
    const trimmed = n.trim()
    if (!trimmed) return
    setName(trimmed)                    // optimistic paint
    const result = await saveName(trimmed)
    if (!result.ok) {
      console.error('Failed to save name:', result.reason)
      // leave the optimistic name; it will reconcile from DB on next load
    }
  }

  const [meals, setMeals] = useState<LoggedMeal[]>([])
  const [week,  setWeek]  = useState<DailyRecord[]>([])

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (uid) {
        const cached = getCachedName(uid)
        if (cached && active) setName(cached)
      }
      const dbName = await fetchName()
      if (active && dbName) setName(dbName)
    })()
    return () => { active = false }
  }, [])

  const loadTargets = async () => {
    setTargetsState({ status: 'loading' })
    const result = await fetchTargets()
    if (result.status === 'ok') {
      setTargetsState({ status: 'ok', targets: result.targets })
    } else if (result.status === 'missing') {
      setTargetsState({ status: 'missing' })
    } else {
      setTargetsState({ status: 'error', message: result.message })
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      const result = await fetchTargets()
      if (!active) return
      if (result.status === 'ok') {
        setTargetsState({ status: 'ok', targets: result.targets })
      } else if (result.status === 'missing') {
        setTargetsState({ status: 'missing' })
      } else {
        setTargetsState({ status: 'error', message: result.message })
      }
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (targetsState.status !== 'ok') return
    let active = true
    ;(async () => {
      const [m, w] = await Promise.all([
        getTodaysMeals(),
        getWeekRecords(0, targetsState.targets),
      ])
      if (active) { setMeals(m); setWeek(w) }
    })()
    return () => { active = false }
  }, [mealVersion, targetsState])

  const targets  = targetsState.status === 'ok' ? targetsState.targets : null
  const consumed = sumMacros(meals)
  // Zone is derived fresh every render from today's meals + clock — never stored
  const now     = new Date()
  const zone    = targets
    ? computeDayZone(consumed.calories, targets.calories, now)
    : null
  const display = targets && zone
    ? zoneDisplay(zone, consumed.calories, targets.calories)
    : null
  const verdict = targets
    ? computeDayVerdict(meals, targets, now)
    : null

  // Called by AddMealSheet after sheet exit. `loggedMeal` is only set for chip instant-logs.
  const handleMealLogged = (loggedMeal?: LoggedMeal) => {
    const newIdx = meals.length   // current count = 0-based index of the new katori

    if (!prefersReduced && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(12) } catch {}
    }

    // Clear any prior katori timers (e.g. undo then re-log)
    katoriTimerRef.current.forEach(clearTimeout)
    katoriTimerRef.current = [
      setTimeout(() => setNewKatoriIdx(newIdx), 1200),
      setTimeout(() => setNewKatoriIdx(null), 1900),
    ]

    setMealVersion(v => v + 1)

    if (loggedMeal) {
      showUndoToast('logged', loggedMeal)
    }
  }

  const handleDeleteMeal = async (meal: LoggedMeal) => {
    await removeMeal(meal.id)
    setMealVersion(v => v + 1)
    showUndoToast('deleted', meal)
  }

  const handleUndo = async () => {
    if (!undoToast) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    katoriTimerRef.current.forEach(clearTimeout)
    katoriTimerRef.current = []
    if (undoToast.action === 'logged') {
      await removeMeal(undoToast.meal.id)
    } else {
      await restoreMeal(undoToast.meal)
    }
    setUndoToast(null)
    setNewKatoriIdx(null)
    setMealVersion(v => v + 1)
  }

  return (
    <motion.div
      className="relative flex h-dvh w-full flex-col bg-white"
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 bg-transparent"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }}
      >
        <motion.div
          className="flex items-center justify-between gap-3 px-4 pb-3"
          {...fadeUp(0, prefersReduced)}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              aria-label="Open settings"
              onClick={() => navigate('/settings')}
              className="flex-shrink-0 rounded-full"
            >
              <AvatarIcon />
            </button>
            <p className="min-w-0 truncate text-[15px] font-semibold leading-tight text-gray-900">
              {name ? `${greeting}, ${name}` : greeting}
            </p>
          </div>
          <button type="button" aria-label="View history" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-50">
            <HistoryIcon />
          </button>
        </motion.div>
        <motion.div className="px-4 pb-4" {...fadeUp(0.02, prefersReduced)}>
          <WeekStrip week={week} />
        </motion.div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto bg-transparent">

        {targetsState.status !== 'ok' || !targets || !zone || !display || !verdict ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
            {targetsState.status === 'loading' && (
              <p className="text-[15px] text-gray-400">Loading…</p>
            )}
            {targetsState.status === 'missing' && (
              <p className="max-w-[280px] text-[15px] leading-relaxed text-gray-500">
                We couldn&apos;t find your targets. Please contact support.
              </p>
            )}
            {targetsState.status === 'error' && (
              <>
                <p className="mb-4 text-[15px] text-gray-500">Couldn&apos;t load your targets.</p>
                <button
                  type="button"
                  onClick={() => void loadTargets()}
                  className="rounded-2xl px-5 py-2.5 text-[15px] font-semibold text-white"
                  style={{ backgroundColor: BRAND_GREEN }}
                >
                  Retry
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6 px-4 pb-4 pt-6">

            {/* Thali — equal space above/below via gap-6 + symmetric py-8 */}
            <motion.div className="relative z-0" {...fadeUp(0.06, prefersReduced)}>
              <Thali
                display={display}
                meals={meals}
                newlyFilledIdx={newKatoriIdx}
                reduced={prefersReduced}
                verdict={verdict}
              />
            </motion.div>

            {/* Coach — structured message from dayVerdict brain */}
            <motion.div {...fadeUp(0.10, prefersReduced)}>
              <CoachCard coach={verdict.coach} />
            </motion.div>

            {/* Macro strip */}
            <motion.div {...fadeUp(0.14, prefersReduced)}>
              <MacroStrip
                targets={targets}
                consumed={consumed}
                dayName={dayName}
                mealsCount={meals.length}
                reduced={prefersReduced}
                verdict={verdict}
              />
            </motion.div>

            {/* Recent meals */}
            <motion.div {...fadeUp(0.22, prefersReduced)}>
              <p className="mb-3 text-[16px] font-bold" style={{ color: BRAND_GREEN }}>
                Recent Meals
              </p>
              {meals.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  {/* initial={false} → suppress entrance for existing rows on mount;
                      new rows (new key) still animate in */}
                  <AnimatePresence initial={false}>
                    {meals.map(meal => (
                      <motion.div
                        key={meal.id}
                        initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6, transition: { duration: 0.2 } }}
                        transition={{ duration: 0.28, ease: 'easeOut' }}
                      >
                        <MealRow meal={meal} onDelete={handleDeleteMeal} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <EmptyMeals />
              )}
            </motion.div>

          </div>
        )}
      </div>

      {/* Add a meal — only when targets are ready */}
      {targetsState.status === 'ok' && (
        <div className="flex-shrink-0 px-4 pt-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="h-14 w-full rounded-2xl text-[17px] font-semibold tracking-wide text-white"
            style={{ backgroundColor: BRAND_GREEN }}
          >
            Add a meal
          </button>
        </div>
      )}

      <AddMealSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onLogged={handleMealLogged}
      />

      {/* Name prompt — modal overlay blocks interaction until set */}
      {!name && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(17,24,39,0.35)',
          }}
        >
          <div className="w-full max-w-sm">
            <NamePrompt onSave={handleSetName} />
          </div>
        </div>
      )}

      {/* Undo toast — chip log or row delete; does not block interaction */}
      <AnimatePresence>
        {undoToast && (
          <motion.div
            key="undo-toast"
            className="pointer-events-none absolute inset-x-0 z-50 flex justify-center px-4"
            style={{ bottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 88px), 108px)' }}
            initial={prefersReduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6, transition: { duration: 0.18 } }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-gray-900 px-4 py-3 shadow-lg">
              <p className="text-[14px] text-white">
                {undoToast.action === 'logged' ? 'Logged' : 'Deleted'}{' '}
                {undoToast.meal.name}
              </p>
              <button
                type="button"
                onClick={handleUndo}
                className="text-[14px] font-semibold"
                style={{ color: '#86EFAC' }}
              >
                Undo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
