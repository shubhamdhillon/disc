import { useState, useRef, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import AddMealSheet from '../components/AddMealSheet'
import {
  getTodaysMeals,
  sumMacros,
  formatMealTime,
  type LoggedMeal,
} from '../lib/mealsStore'

const BRAND_GREEN = '#1C7C2E'
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

// ─── Targets (from onboarding localStorage, or safe fallback) ─────────────────
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
    <svg
      width="20" height="20" viewBox="0 0 24 24"
      fill="none" stroke="#9ca3af"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
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
// Redesign from the screenshot: Protein is the priority macro — larger number,
// full-width progress bar. Carbs and Fat are compact and equal beside each other.
function MacroStrip({
  targets, consumed, dayName, mealsCount,
}: {
  targets:    MacroTargets
  consumed:   MacroTargets
  dayName:    string
  mealsCount: number
}) {
  const pPct = Math.min((consumed.protein / targets.protein) * 100, 100)
  const cPct = Math.min((consumed.carbs   / targets.carbs)   * 100, 100)
  const fPct = Math.min((consumed.fat     / targets.fat)     * 100, 100)

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100">
      {/* Green header band */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: BRAND_GREEN }}>
        <span className="text-[13px] font-semibold text-white">{dayName}</span>
        <span className="text-[12px] text-green-200">
          {mealsCount} {mealsCount === 1 ? 'meal' : 'meals'} logged
        </span>
      </div>

      {/* Protein — full-width, dominant */}
      <div className="px-4 pt-4 pb-3">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[13px] font-semibold text-gray-700">Protein</span>
          <div className="flex items-baseline gap-1">
            <span className="text-[22px] font-bold leading-none" style={{ color: BRAND_GREEN }}>
              {consumed.protein}
            </span>
            <span className="text-[12px] text-gray-400">/ {targets.protein}g</span>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full"
            style={{ width: `${pPct}%`, backgroundColor: BRAND_GREEN }}
          />
        </div>
      </div>

      <div className="mx-4 h-px bg-gray-50" />

      {/* Carbs + Fats — compact, supporting */}
      <div className="flex gap-5 px-4 py-3">
        <div className="flex-1">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[11px] font-medium text-gray-400">Carbs</span>
            <span className="text-[13px] font-semibold text-gray-700">
              {consumed.carbs}
              <span className="ml-0.5 text-[10px] font-normal text-gray-400">/{targets.carbs}g</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-amber-400" style={{ width: `${cPct}%` }} />
          </div>
        </div>
        <div className="flex-1">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[11px] font-medium text-gray-400">Fats</span>
            <span className="text-[13px] font-semibold text-gray-700">
              {consumed.fat}
              <span className="ml-0.5 text-[10px] font-normal text-gray-400">/{targets.fat}g</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-violet-400" style={{ width: `${fPct}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Thali ────────────────────────────────────────────────────────────────────
// The hero plate. Katoris (small circles) orbit the rim.
// Filled katoris = meals logged. Empty katoris = available slots.
const TOTAL_KATORIS = 6

// Positions on a 300×300 viewbox, orbit radius ≈112px from center (150,150).
// Angles start at the top (-90°) and step 60° clockwise.
const KATORI_POSITIONS = [
  { top: '13%', left: '50%' },   // top
  { top: '32%', left: '82%' },   // top-right
  { top: '68%', left: '82%' },   // bottom-right
  { top: '87%', left: '50%' },   // bottom
  { top: '68%', left: '18%' },   // bottom-left
  { top: '32%', left: '18%' },   // top-left
]

function Thali({ remaining, goal, filledCount }: {
  remaining:   number
  goal:        number
  filledCount: number
}) {
  return (
    <div className="flex justify-center">
      <div
        className="relative flex aspect-square w-full max-w-[300px] items-center justify-center rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(28,124,46,0.07) 0%, rgba(28,124,46,0.03) 65%, transparent 100%)',
          border: '1.5px solid rgba(28,124,46,0.15)',
          boxShadow: '0 0 72px 28px rgba(28,124,46,0.07)',
        }}
      >
        {/* Katoris orbiting the rim */}
        {KATORI_POSITIONS.map((pos, i) => (
          <div
            key={i}
            className="absolute h-12 w-12 rounded-full"
            style={{
              top: pos.top, left: pos.left,
              transform: 'translate(-50%, -50%)',
              ...(i < filledCount
                ? { backgroundColor: 'rgba(28,124,46,0.14)' }
                : { border: '1.5px dashed rgba(28,124,46,0.25)' }),
            }}
          />
        ))}

        {/* Center display */}
        <div className="z-10 flex flex-col items-center">
          <p className="text-[42px] font-bold leading-none tracking-tight text-gray-900">
            {remaining.toLocaleString()}
            <span className="ml-1.5 text-[18px] font-medium text-gray-400">cal</span>
          </p>
          <p className="mt-2 text-[13px] text-gray-400">
            left of {goal.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Meal row ──────────────────────────────────────────────────────────────────
function MealRow({ meal }: { meal: LoggedMeal }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5">
      <div
        className="h-9 w-9 flex-shrink-0 rounded-xl"
        style={{ backgroundColor: 'rgba(28,124,46,0.09)' }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-gray-800">{meal.name}</p>
        <p className="mt-0.5 text-[12px] text-gray-400">{formatMealTime(meal.timestamp)}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-[14px] font-semibold text-gray-800">{meal.calories} cal</p>
        <p className="mt-0.5 text-[12px] text-gray-400">{meal.protein}g protein</p>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyMeals() {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div
        className="mb-4 h-12 w-12 rounded-full"
        style={{ border: '2px dashed rgba(28,124,46,0.28)' }}
      />
      <p className="text-[14px] font-medium text-gray-500">Nothing here yet</p>
      <p className="mt-1 text-[13px] text-gray-400">Your first meal will appear here</p>
    </div>
  )
}

// ─── Animation helper ─────────────────────────────────────────────────────────
function fadeUp(delay: number, reduced: boolean) {
  return {
    initial:    reduced ? false : { opacity: 0, y: 12 },
    animate:    { opacity: 1, y: 0 },
    transition: { delay, duration: 0.4, ease: 'easeOut' },
  }
}

// ─── Today screen ─────────────────────────────────────────────────────────────
export default function Today() {
  const prefersReduced = useReducedMotion() ?? false
  const targets        = loadTargets()
  const dayName        = WEEKDAYS[new Date().getDay()]
  const greeting       = getGreeting()

  const [name, setName]         = useState<string | null>(
    () => localStorage.getItem('disc_name'),
  )
  const [sheetOpen, setSheetOpen]   = useState(false)
  // Incremented by handleMealLogged → invalidates the useMemo below → fresh
  // localStorage read → React re-renders all dependent UI in the same tick.
  const [mealVersion, setMealVersion] = useState(0)

  const handleSetName = (n: string) => {
    localStorage.setItem('disc_name', n)
    setName(n)
  }

  const handleMealLogged = () => setMealVersion(v => v + 1)

  // Re-reads the store every time mealVersion increments (i.e. after each log).
  const meals    = useMemo(() => getTodaysMeals(), [mealVersion])
  const consumed = sumMacros(meals)
  const remaining = Math.max(0, targets.calories - consumed.calories)

  return (
    <motion.div
      className="flex h-dvh flex-col bg-white"
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* ── Header ── */}
      <div
        className="flex flex-shrink-0 items-center justify-between px-5 pb-4"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 20px)' }}
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
        <button
          type="button"
          aria-label="View history"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-50"
        >
          <HistoryIcon />
        </button>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Name prompt — only shown once, before any name is stored */}
        {!name && <NamePrompt onSave={handleSetName} />}

        <div className="flex flex-col gap-6 px-5 pb-4">

          {/* Macro strip */}
          <motion.div {...fadeUp(0.05, prefersReduced)}>
            <MacroStrip
              targets={targets}
              consumed={consumed}
              dayName={dayName}
              mealsCount={meals.length}
            />
          </motion.div>

          {/* Thali */}
          <motion.div {...fadeUp(0.15, prefersReduced)}>
            <Thali
              remaining={remaining}
              goal={targets.calories}
              filledCount={Math.min(meals.length, TOTAL_KATORIS)}
            />
          </motion.div>

          {/* Recent Meals */}
          <motion.div {...fadeUp(0.25, prefersReduced)}>
            <p className="mb-3 text-[16px] font-bold" style={{ color: BRAND_GREEN }}>
              Recent Meals
            </p>
            {meals.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {meals.map((meal, i) => (
                  <motion.div
                    key={meal.id}
                    {...fadeUp(0.3 + i * 0.07, prefersReduced)}
                  >
                    <MealRow meal={meal} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyMeals />
            )}
          </motion.div>

        </div>
      </div>

      {/* ── Add a meal ── */}
      <div className="flex-shrink-0 px-5 pb-10 pt-2">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="h-14 w-full rounded-2xl text-[17px] font-semibold tracking-wide text-white"
          style={{ backgroundColor: BRAND_GREEN }}
        >
          Add a meal
        </button>
      </div>

      {/* ── Add Meal Sheet — rendered outside scroll container so z-index works ── */}
      <AddMealSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onLogged={handleMealLogged}
      />
    </motion.div>
  )
}
