import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { estimateMeal, EstimateError } from '../lib/estimateMeal'
import { addMeal, type LoggedMeal } from '../lib/mealsStore'
import { cacheMeal, lookupMeal, getFrequentMeals, type CachedMeal } from '../lib/mealCache'
import type { MealEstimate } from '../lib/estimateMeal'
import QualityIcons from './QualityIcons'

const BRAND_GREEN = '#1C7C2E'
const SHEET_TAG   = '[AddMealSheet]'

type SheetState = 'input' | 'estimating' | 'confirm'

/**
 * Client-side pre-filter — only blocks inputs that are OBVIOUSLY not a meal.
 * When in doubt, let it through; a false rejection is worse than one extra call.
 *
 * Passes (correctly): "2 roti dal sabzi", "40-50gm oats 1 scoop whey",
 *                     "idli sambar", "rice", "poha"
 * Blocks:             "" (empty), "x" (single char), "!!" (no letters at all)
 */
function checkJunk(text: string): string | null {
  const t = text.trim()
  if (t.length === 0) return 'empty input'
  if (t.length === 1 && !/[a-zA-Z]/.test(t)) return 'single non-letter character'
  return null  // not junk
}

/** Map an EstimateError code to a friendly user-facing string.
 *  In DEV, appends a diagnostic tag so the raw error is visible on-device
 *  without opening devtools: "[RATE_LIMITED · http 429 · 1234ms]".
 *  The production message is always the plain human string.
 */
function friendlyMessage(err: unknown, elapsedMs?: number): string {
  if (!(err instanceof EstimateError)) {
    return "Couldn't estimate right now — please try again."
  }
  let base: string
  switch (err.code) {
    case 'TIMEOUT':             base = "Taking too long — please try again."; break
    case 'NETWORK_ERROR':       base = "Couldn't connect — check your internet and try again."; break
    case 'AUTH_FAILURE':        base = "API key issue — check your .env file and refresh."; break
    case 'RATE_LIMITED':        base = "Too many requests — wait a moment, then try again."; break
    case 'SAFETY_BLOCK':        base = "That was blocked by content filters — try rephrasing."; break
    case 'EMPTY_RESPONSE':
    case 'PARSE_FAILED':        base = "Couldn't read the response — please try again."; break
    case 'NO_API_KEY':          base = "API key is not configured — check your .env file."; break
    case 'MODEL_NOT_AVAILABLE': base = "Estimation service unavailable — please try again later."; break
    default:                    base = "Couldn't estimate right now — please try again."
  }
  if (import.meta.env.DEV) {
    const parts = [err.code]
    if (err.httpStatus !== null) parts.push(`http ${err.httpStatus}`)
    if (elapsedMs !== undefined) parts.push(`${elapsedMs}ms`)
    base += `  [${parts.join(' · ')}]`
  }
  return base
}

// ── Internal icons ─────────────────────────────────────────────────────────────

function StarIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path
        d="M50 5 C47 32 32 47 5 50 C32 53 47 68 50 95 C53 68 68 53 95 50 C68 47 53 32 50 5Z"
        fill={BRAND_GREEN}
      />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

// ── State 1: Input ─────────────────────────────────────────────────────────────
interface InputStateProps {
  onSubmit:     (text: string) => void
  errorMsg:     string | null
  defaultValue: string
  // Instant-log a frequent cached meal (no confirm, no API).
  onQuickLog:   (meal: CachedMeal) => void
}

function truncateChipName(name: string, max = 14): string {
  if (name.length <= max) return name
  return name.slice(0, max).trimEnd() + '…'
}

function InputState({ onSubmit, errorMsg, defaultValue, onQuickLog }: InputStateProps) {
  const [value, setValue] = useState(defaultValue)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [frequent, setFrequent] = useState<CachedMeal[]>([])

  useEffect(() => {
    setFrequent(getFrequentMeals(4))
  }, [])

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed) onSubmit(trimmed)
  }

  return (
    <motion.div
      key="input"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <p className="mb-1 text-[22px] font-bold text-gray-900">What did you eat?</p>
      <p className="mb-5 text-[14px] text-gray-400">Describe in a few words — we'll figure out the rest.</p>

      {/* Text area */}
      <div className="rounded-2xl bg-gray-50 px-4 py-3.5">
        <textarea
          ref={textareaRef}
          autoFocus
          rows={3}
          placeholder="e.g. 2 roti, dal, sabzi"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          className="w-full resize-none bg-transparent text-[16px] leading-relaxed text-gray-800 outline-none placeholder:text-gray-300"
        />
      </div>

      {/* Error message */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 flex flex-col items-center gap-1.5"
          >
            <p className="text-center text-[13px] font-medium text-amber-600">{errorMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Frequent-meal quick-log chips — shortcut only, no empty state */}
      {frequent.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {frequent.map(meal => (
            <button
              key={`${meal.name}-${meal.calories}-${meal.lastUsed}`}
              type="button"
              onClick={() => onQuickLog(meal)}
              className="flex-shrink-0 rounded-full border border-green-100 px-3 py-1.5 text-left"
              style={{ backgroundColor: 'rgba(28,124,46,0.08)' }}
            >
              <span className="text-[13px] font-medium" style={{ color: BRAND_GREEN }}>
                {truncateChipName(meal.name)}
              </span>
              <span className="text-[13px] text-gray-400"> · {meal.calories}</span>
            </button>
          ))}
        </div>
      )}

      {/* Estimate CTA — full width now that the photo button is deferred */}
      <div className="mt-4">
        <button
          type="button"
          disabled={!value.trim()}
          onClick={handleSubmit}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl text-[16px] font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ backgroundColor: BRAND_GREEN }}
        >
          Estimate
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </motion.div>
  )
}

// ── State 2: Estimating ────────────────────────────────────────────────────────
function EstimatingState({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      key="estimating"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center py-10"
    >
      <motion.div
        animate={reduced ? {} : { scale: [1, 1.1, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <StarIcon size={44} />
      </motion.div>
      <p className="mt-5 text-[15px] font-medium text-gray-400">Reading your meal…</p>
    </motion.div>
  )
}

// ── State 3: Confirm ───────────────────────────────────────────────────────────
// Name, calories, and protein are inline-editable before logging.
// Carbs and fat from the estimate are carried through without being shown as
// editable tiles — keeps the UI focused on the numbers users care about most.
function ConfirmState({
  estimate,
  onLog,
  onBack,
  manual,
  originalInput,
}: {
  estimate:       MealEstimate
  onLog:          (meal: MealEstimate) => void
  onBack:         () => void
  // When true the user arrived via the manual path — calories and protein
  // start empty so they can type their own values rather than editing a 0.
  manual?:        boolean
  // Raw text the user typed — used as the cache key (not the model name).
  originalInput:  string
}) {
  const reduced                 = useReducedMotion() ?? false
  const [name,     setName]     = useState(estimate.name)
  const [calories, setCalories] = useState(manual ? '' : String(estimate.calories))
  const [protein,  setProtein]  = useState(manual ? '' : String(estimate.protein))

  // Calories must be a positive integer to log. Protein may be 0 or empty.
  const calorieVal = parseInt(calories) || 0
  const canLog     = calorieVal > 0

  const handleLog = () => {
    if (!canLog) return
    const meal = {
      name:     name.trim() || estimate.name,
      calories: calorieVal,
      protein:  Math.max(0, parseInt(protein) || 0),
      carbs:    estimate.carbs,
      fat:      estimate.fat,
      sugar:    estimate.sugar,
      quality:  estimate.quality,
    }
    onLog(meal)
    // Cache under the user's typed text so future lookups match their input.
    // Uses the confirmed/edited values (same as what was logged).
    cacheMeal(originalInput, meal)
  }

  return (
    <motion.div
      key="confirm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="flex flex-col gap-4"
    >
      {/* Heading + Start over */}
      <div className="flex items-center justify-between">
        <p className="text-[22px] font-bold text-gray-900">Here's what I got</p>
        <button
          type="button"
          onClick={onBack}
          className="text-[16px] font-semibold"
          style={{ color: BRAND_GREEN }}
        >
          Start over
        </button>
      </div>

      {/* Meal name + quality icons */}
      <div className="border-b border-gray-100 pb-3">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-400">Meal</p>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full bg-transparent text-[18px] font-semibold text-gray-900 outline-none"
        />
        {estimate.quality?.length > 0 && (
          <div className="mt-2">
            <QualityIcons tags={estimate.quality} size={16} />
          </div>
        )}
      </div>

      {/* Calories + Protein — editable tiles.
          type="text" + inputMode="numeric" shows the iOS numeric keypad without
          number-input quirks (spinners, accepting "e" / "+" / "-"). */}
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col items-center rounded-2xl bg-gray-50 px-4 py-4">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">Calories</p>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={calories}
            onChange={e => setCalories(e.target.value.replace(/[^0-9]/g, ''))}
            className="w-full bg-transparent text-center text-[32px] font-bold leading-none text-gray-900 outline-none"
          />
          <p className="mt-1 text-[12px] text-gray-400">kcal</p>
        </div>
        <div className="flex flex-1 flex-col items-center rounded-2xl bg-gray-50 px-4 py-4">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">Protein</p>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={protein}
            onChange={e => setProtein(e.target.value.replace(/[^0-9]/g, ''))}
            className="w-full bg-transparent text-center text-[32px] font-bold leading-none text-gray-900 outline-none"
          />
          <p className="mt-1 text-[12px] text-gray-400">grams</p>
        </div>
      </div>

      {/* Sugar — display-only, subordinate to the tiles above */}
      {estimate.sugar > 0 && (
        <p className="text-[13px] text-gray-400">Sugar {estimate.sugar}g</p>
      )}

      {/* Log it — disabled until calories > 0; label reflects state */}
      <motion.button
        type="button"
        onClick={handleLog}
        disabled={!canLog}
        className="h-14 w-full rounded-2xl text-[17px] font-semibold tracking-wide text-white transition-opacity disabled:opacity-40"
        style={{ backgroundColor: BRAND_GREEN }}
        whileTap={reduced || !canLog ? {} : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        {canLog ? 'Log it' : 'Add calories to log'}
      </motion.button>
    </motion.div>
  )
}

// ── AddMealSheet ───────────────────────────────────────────────────────────────
interface AddMealSheetProps {
  isOpen:    boolean
  onClose:   () => void
  /** Called after sheet exit when a meal was logged. Passes the full meal only for chip instant-logs. */
  onLogged?: (meal?: LoggedMeal) => void
}

export default function AddMealSheet({ isOpen, onClose, onLogged }: AddMealSheetProps) {
  const prefersReduced = useReducedMotion() ?? false

  const [state,          setState]          = useState<SheetState>('input')
  const [estimate,       setEstimate]       = useState<MealEstimate | null>(null)
  const [errorMsg,       setErrorMsg]       = useState<string | null>(null)
  // Preserved so the textarea is restored when we bounce back from estimating on error
  const [lastInput,      setLastInput]      = useState('')
  // Manual ConfirmState path (blank calorie/protein fields). No UI trigger currently —
  // frequent chips are the no-API fallback. To re-enable: setEstimate from lastInput
  // with zeros, setIsManual(true), setState('confirm').
  const [isManual,       setIsManual]       = useState(false)

  // Incremented on every new request and on close. Any in-flight promise
  // that resolves after the id has changed is silently discarded.
  const requestIdRef   = useRef(0)
  // Set to true in handleLog so onExitComplete knows to fire onLogged.
  const mealLoggedRef  = useRef(false)
  // Set only for chip instant-logs — full meal for undo toast.
  const instantUndoRef = useRef<LoggedMeal | null>(null)

  const resetAndClose = () => {
    requestIdRef.current += 1   // invalidate any in-flight estimate
    onClose()
    // State reset and onLogged callback are deferred to onExitComplete on the
    // outer AnimatePresence, which fires after the sheet spring finishes.
  }

  // Instant chip-log — no confirm, no API. Undo toast is offered via onLogged.
  const handleQuickLog = (cached: CachedMeal) => {
    const record = addMeal({
      name:     cached.name,
      calories: cached.calories,
      protein:  cached.protein,
      carbs:    cached.carbs,
      fat:      cached.fat,
      sugar:    cached.sugar,
      quality:  cached.quality,
    })
    mealLoggedRef.current  = true
    instantUndoRef.current = record
    resetAndClose()
  }

  const handleSubmit = async (text: string) => {
    // ── Client-side pre-check ──────────────────────────────────────────────────
    // Only blocks truly empty / single-non-letter inputs. When in doubt, let
    // the API decide — a false rejection is worse than an extra call.
    const junkReason = checkJunk(text)
    if (junkReason) {
      console.warn(`${SHEET_TAG} PRE_FILTER_BLOCKED input="${text.slice(0, 40)}" reason="${junkReason}"`)
      setErrorMsg("Please describe your meal in a bit more detail.")
      return
    }

    // ── Cache hit — skip the API, go straight to confirm ─────────────────────
    const cached = lookupMeal(text)
    if (cached) {
      setEstimate({
        name:     cached.name,
        calories: cached.calories,
        protein:  cached.protein,
        carbs:    cached.carbs,
        fat:      cached.fat,
        sugar:    cached.sugar,
        quality:  cached.quality,
      })
      setLastInput(text)
      setState('confirm')
      return
    }

    setLastInput(text)
    setErrorMsg(null)
    setState('estimating')

    // Capture the id before the await. If it no longer matches after the
    // promise settles, the sheet was closed while the request was in flight.
    requestIdRef.current += 1
    const thisId = requestIdRef.current
    const t0     = performance.now()

    try {
      const result = await estimateMeal(text)

      if (requestIdRef.current !== thisId) return   // sheet closed — discard

      // ── Model says "not a meal" ────────────────────────────────────────────
      if (!result.valid) {
        setState('input')
        setErrorMsg("Hmm, that doesn't look like a meal — mind describing what you ate?")
        return
      }

      // ── Valid estimate ─────────────────────────────────────────────────────
      // TEMP — verify model returns quality/sugar; remove once confirmed
      if (import.meta.env.DEV) console.log('[EST]', JSON.stringify(result))

      setEstimate({
        name:     result.name,
        calories: result.calories,
        protein:  result.protein,
        carbs:    result.carbs,
        fat:      result.fat,
        sugar:    result.sugar,
        quality:  result.quality,
      })
      setState('confirm')

    } catch (err) {
      if (requestIdRef.current !== thisId) return   // sheet closed — discard
      console.error(`${SHEET_TAG} estimate failed:`, err)
      setState('input')
      setErrorMsg(friendlyMessage(err, Math.round(performance.now() - t0)))
    }
  }

  const handleLog = (meal: MealEstimate) => {
    addMeal(meal)
    mealLoggedRef.current  = true   // onExitComplete will fire onLogged after sheet exits
    instantUndoRef.current = null   // normal confirm-log — no undo toast
    resetAndClose()
  }

  const handleBack = () => {
    setState('input')
    setEstimate(null)
    setErrorMsg(null)
    setIsManual(false)
  }

  const handleExitComplete = () => {
    // Reset all internal state once the sheet is fully off screen.
    setState('input')
    setEstimate(null)
    setErrorMsg(null)
    setLastInput('')
    setIsManual(false)
    // Fire the "meal was logged" callback now that the plate is visible.
    if (mealLoggedRef.current) {
      mealLoggedRef.current = false
      const undo = instantUndoRef.current
      instantUndoRef.current = null
      onLogged?.(undo ?? undefined)
    }
  }

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={resetAndClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] bg-white px-5 pb-10 pt-3"
            initial={prefersReduced ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280, mass: 0.9 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 400) {
                resetAndClose()
              }
            }}
          >
            {/* Drag handle */}
            <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-gray-200" />

            {/* State content */}
            <AnimatePresence mode="wait">
              {state === 'input' && (
                <InputState
                  key="input"
                  onSubmit={handleSubmit}
                  errorMsg={errorMsg}
                  defaultValue={lastInput}
                  onQuickLog={handleQuickLog}
                />
              )}
              {state === 'estimating' && (
                <EstimatingState key="estimating" reduced={prefersReduced} />
              )}
              {state === 'confirm' && estimate && (
                <ConfirmState
                  key="confirm"
                  estimate={estimate}
                  onLog={handleLog}
                  onBack={handleBack}
                  manual={isManual}
                  originalInput={lastInput}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
