import { useState, useRef, useMemo, useEffect, useLayoutEffect } from 'react'
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

interface MacroTargets { calories: number; protein: number; carbs: number; fat: number }

function loadTargets(): MacroTargets {
  try {
    const raw = localStorage.getItem('disc_targets')
    if (raw) {
      const t = JSON.parse(raw)
      if (t?.calories && t?.protein) return t as MacroTargets
    }
  } catch (_) {}
  return { calories: 2180, protein: 145, carbs: 240, fat: 65 }
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
        copy: 'Right on target. Good day.',
        numberColor: '#111827',
        showCalUnit: true,
      }
    case 'over':
      return {
        number: overage,
        sublabel: 'over today',
        copy: `${overage} over today. Reset at midnight.`,
        numberColor: accent,
        showCalUnit: true,
      }
    case 'under':
      return {
        number: deficit,
        sublabel: 'under target',
        copy: `You're ${deficit} under — eat something.`,
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
    <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-green-100 bg-green-50">
      <svg width="20" height="20" viewBox="0 0 100 100" aria-hidden="true">
        <path
          d="M50 5 C47 32 32 47 5 50 C32 53 47 68 50 95 C53 68 68 53 95 50 C68 47 53 32 50 5Z"
          fill={BRAND_GREEN}
        />
      </svg>
    </div>
  )
}

function HistoryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
      <polyline points="12 7 12 12 15.5 14" />
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
      className="mx-5 mb-5 rounded-2xl bg-green-50 px-4 py-4"
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
function MacroStrip({
  targets, consumed, dayName, mealsCount, reduced,
}: {
  targets:    MacroTargets
  consumed:   MacroTargets
  dayName:    string
  mealsCount: number
  reduced:    boolean
}) {
  // Width stays capped at 100%; overage is signalled via terracotta colour
  const pPct = Math.min((consumed.protein / targets.protein) * 100, 100)
  const cPct = Math.min((consumed.carbs   / targets.carbs)   * 100, 100)
  const fPct = Math.min((consumed.fat     / targets.fat)     * 100, 100)

  const pOver = consumed.protein > targets.protein
  const cOver = consumed.carbs   > targets.carbs
  const fOver = consumed.fat     > targets.fat

  const pColor = pOver ? TERRACOTTA : BRAND_GREEN
  const cColor = cOver ? TERRACOTTA : '#fbbf24' // amber-400
  const fColor = fOver ? TERRACOTTA : '#a78bfa' // violet-400

  const barT = reduced
    ? { duration: 0 }
    : { duration: 0.6, ease: 'easeOut' as const }
  const colorT = reduced
    ? { duration: 0 }
    : { duration: 0.4, ease: 'easeOut' as const }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100">
      <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: BRAND_GREEN }}>
        <span className="text-[13px] font-semibold text-white">{dayName}</span>
        <span className="text-[12px] text-green-200">
          {mealsCount} {mealsCount === 1 ? 'meal' : 'meals'} logged
        </span>
      </div>

      {/* Protein — dominant */}
      <div className="px-4 pt-4 pb-3">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[13px] font-semibold text-gray-700">Protein</span>
          <div className="flex items-baseline gap-1">
            <CountUp
              target={consumed.protein}
              duration={600}
              reduced={reduced}
              className="text-[22px] font-bold leading-none"
              style={{ color: pColor }}
            />
            <span className="text-[12px] text-gray-400">/ {targets.protein}g</span>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <motion.div
            className="h-full rounded-full"
            initial={false}
            animate={{ width: `${pPct}%`, backgroundColor: pColor }}
            transition={{ width: barT, backgroundColor: colorT }}
          />
        </div>
      </div>

      <div className="mx-4 h-px bg-gray-50" />

      {/* Carbs + Fats — supporting */}
      <div className="flex gap-5 px-4 py-3">
        <div className="flex-1">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[11px] font-medium text-gray-400">Carbs</span>
            <span className="text-[13px] font-semibold text-gray-700">
              <CountUp
                target={consumed.carbs}
                duration={600}
                reduced={reduced}
                style={cOver ? { color: TERRACOTTA } : undefined}
              />
              <span className="ml-0.5 text-[10px] font-normal text-gray-400">/{targets.carbs}g</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <motion.div
              className="h-full rounded-full"
              initial={false}
              animate={{ width: `${cPct}%`, backgroundColor: cColor }}
              transition={{ width: barT, backgroundColor: colorT }}
            />
          </div>
        </div>
        <div className="flex-1">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[11px] font-medium text-gray-400">Fats</span>
            <span className="text-[13px] font-semibold text-gray-700">
              <CountUp
                target={consumed.fat}
                duration={600}
                reduced={reduced}
                style={fOver ? { color: TERRACOTTA } : undefined}
              />
              <span className="ml-0.5 text-[10px] font-normal text-gray-400">/{targets.fat}g</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <motion.div
              className="h-full rounded-full"
              initial={false}
              animate={{ width: `${fPct}%`, backgroundColor: fColor }}
              transition={{ width: barT, backgroundColor: colorT }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Thali ────────────────────────────────────────────────────────────────────
function Thali({
  zone, display, filledCount, newlyFilledIdx, reduced,
}: {
  zone:            DayZone
  display:         ZoneDisplay
  filledCount:     number
  newlyFilledIdx:  number | null
  reduced:         boolean
}) {
  // Always at least 6 rim slots; grow so every logged meal has a bowl
  const slotCount = Math.max(6, filledCount)
  const positions = katoriPositions(slotCount)
  const sizePx    = katoriSizePx(slotCount)
  const visual    = ZONE_VISUAL[zone]

  const colorT = reduced
    ? { duration: 0 }
    : { duration: 0.4, ease: 'easeOut' as const }

  const filledBg  = `rgba(${visual.glowRgb},0.14)`
  const emptyBorder = `1.5px dashed rgba(${visual.glowRgb},0.28)`
  const plateBg = `radial-gradient(circle, rgba(${visual.glowRgb},0.07) 0%, rgba(${visual.glowRgb},0.03) 65%, transparent 100%)`
  const plateShadow = `0 0 72px 28px rgba(${visual.glowRgb},${visual.glowStrength})`

  const showPulse = !reduced && visual.pulse
  const showFullGlow = !reduced && visual.glowFull

  return (
    <div className="flex flex-col items-center">
      <motion.div
        className="relative flex aspect-square w-full max-w-[300px] items-center justify-center rounded-full"
        style={{
          borderWidth: 1.5,
          borderStyle: 'solid',
          // Gradient snaps with the zone; border + glow ease below
          background: plateBg,
        }}
        initial={false}
        animate={{
          borderColor: visual.border,
          boxShadow: plateShadow,
        }}
        transition={colorT}
      >
        {/* Ambient glow — pulse for building/closing; solid full for landed */}
        {showPulse && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ background: `radial-gradient(circle, rgba(${visual.glowRgb},0.07) 0%, transparent 65%)` }}
            animate={{ opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        {showFullGlow && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle, rgba(${visual.glowRgb},0.14) 0%, transparent 65%)`,
              opacity: 1,
            }}
          />
        )}

        {/* Katoris — outer div = position, inner motion.div = spring/fade */}
        {positions.map((pos, i) => {
          const isFilled      = i < filledCount
          const isNewlyFilled = i === newlyFilledIdx
          const isNew         = isNewlyFilled && !reduced

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
                {isFilled ? (
                  <motion.div
                    key="filled"
                    className="rounded-full"
                    style={{ width: sizePx, height: sizePx, backgroundColor: filledBg }}
                    initial={kInit}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={kTransition}
                  />
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
        <div className="z-10 flex flex-col items-center px-6">
          <p
            className="text-[42px] font-bold leading-none tracking-tight"
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
              <span className="ml-1.5 text-[18px] font-medium text-gray-400">cal</span>
            )}
          </p>
          <p className="mt-2 text-[13px] text-gray-400">{display.sublabel}</p>
        </div>
      </motion.div>

      {/* Zone copy line — outside the plate for breathing room */}
      <AnimatePresence mode="wait">
        {display.copy && (
          <motion.p
            key={display.copy}
            className="mt-4 max-w-[280px] text-center text-[13px] font-medium"
            style={{ color: visual.accent }}
            initial={reduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {display.copy}
          </motion.p>
        )}
      </AnimatePresence>
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

// ─── Today screen ─────────────────────────────────────────────────────────────
export default function Today() {
  const prefersReduced = useReducedMotion() ?? false
  const targets        = loadTargets()
  const dayName        = WEEKDAYS[new Date().getDay()]
  const greeting       = getGreeting()

  const [name,          setName]          = useState<string | null>(() => localStorage.getItem('disc_name'))
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

  const showUndoToast = (action: 'logged' | 'deleted', meal: LoggedMeal) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoToast({ action, meal })
    undoTimerRef.current = setTimeout(() => setUndoToast(null), 4000)
  }

  const handleSetName = (n: string) => {
    localStorage.setItem('disc_name', n)
    setName(n)
  }

  const meals     = useMemo(() => getTodaysMeals(), [mealVersion])
  const consumed  = sumMacros(meals)
  // Zone is derived fresh every render from today's meals + clock — never stored
  const now       = new Date()
  const zone      = computeDayZone(consumed.calories, targets.calories, now)
  const display   = zoneDisplay(zone, consumed.calories, targets.calories)

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

  const handleDeleteMeal = (meal: LoggedMeal) => {
    removeMeal(meal.id)
    setMealVersion(v => v + 1)
    showUndoToast('deleted', meal)
  }

  const handleUndo = () => {
    if (!undoToast) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    katoriTimerRef.current.forEach(clearTimeout)
    katoriTimerRef.current = []
    if (undoToast.action === 'logged') {
      removeMeal(undoToast.meal.id)
    } else {
      restoreMeal(undoToast.meal)
    }
    setUndoToast(null)
    setNewKatoriIdx(null)
    setMealVersion(v => v + 1)
  }

  return (
    <motion.div
      className="relative flex h-dvh flex-col bg-white"
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Header */}
      <motion.div
        className="flex flex-shrink-0 items-center justify-between px-5 pb-4"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 20px)' }}
        {...fadeUp(0, prefersReduced)}
      >
        <div className="flex items-center gap-3">
          <AvatarIcon />
          <div>
            {name ? (
              <>
                <p className="text-[11px] text-gray-400">{greeting}</p>
                <p className="text-[16px] font-semibold leading-tight text-gray-900">{name}</p>
              </>
            ) : (
              <p className="text-[16px] font-semibold text-gray-900">{greeting} 👋</p>
            )}
          </div>
        </div>
        <button type="button" aria-label="View history" className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-50">
          <HistoryIcon />
        </button>
      </motion.div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {!name && <NamePrompt onSave={handleSetName} />}

        <div className="flex flex-col gap-6 px-5 pb-4">

          {/* Macro strip — staggered entrance */}
          <motion.div {...fadeUp(0.06, prefersReduced)}>
            <MacroStrip
              targets={targets}
              consumed={consumed}
              dayName={dayName}
              mealsCount={meals.length}
              reduced={prefersReduced}
            />
          </motion.div>

          {/* Thali plate */}
          <motion.div {...fadeUp(0.14, prefersReduced)}>
            <Thali
              zone={zone}
              display={display}
              filledCount={meals.length}
              newlyFilledIdx={newKatoriIdx}
              reduced={prefersReduced}
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
      </div>

      {/* Add a meal */}
      <div className="flex-shrink-0 px-5 pt-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="h-14 w-full rounded-2xl text-[17px] font-semibold tracking-wide text-white"
          style={{ backgroundColor: BRAND_GREEN }}
        >
          Add a meal
        </button>
      </div>

      <AddMealSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onLogged={handleMealLogged}
      />

      {/* Undo toast — chip log or row delete; does not block interaction */}
      <AnimatePresence>
        {undoToast && (
          <motion.div
            key="undo-toast"
            className="pointer-events-none absolute inset-x-0 z-50 flex justify-center px-5"
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
