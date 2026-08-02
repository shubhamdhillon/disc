import { useState, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { estimateMeal, EstimateError } from '../lib/estimateMeal'
import { addMeal } from '../lib/mealsStore'
import type { MealEstimate } from '../lib/estimateMeal'

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

/** Map an EstimateError code to a friendly user-facing string. */
function friendlyMessage(err: unknown): string {
  if (!(err instanceof EstimateError)) {
    return "Couldn't estimate right now — please try again."
  }
  switch (err.code) {
    case 'TIMEOUT':
      return "Taking too long — please try again."
    case 'NETWORK_ERROR':
      return "Couldn't connect — check your internet and try again."
    case 'AUTH_FAILURE':
      return "API key issue — check your .env file and refresh."
    case 'RATE_LIMITED':
      return "Too many requests — wait a moment, then try again."
    case 'SAFETY_BLOCK':
      return "That was blocked by content filters — try rephrasing."
    case 'EMPTY_RESPONSE':
    case 'PARSE_FAILED':
      return "Couldn't read the response — please try again."
    case 'NO_API_KEY':
      return "API key is not configured — check your .env file."
    case 'MODEL_NOT_AVAILABLE':
      return "Estimation service unavailable — please try again later."
    default:
      return "Couldn't estimate right now — please try again."
  }
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
  // When set, an "Enter it manually" escape hatch is shown below the error.
  // Only provided after an API failure or a "not a meal" rejection — not for
  // the junk pre-check, which doesn't warrant skipping the estimate.
  onManual:     (() => void) | null
}

function InputState({ onSubmit, errorMsg, defaultValue, onManual }: InputStateProps) {
  const [value, setValue] = useState(defaultValue)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

      {/* Error message + optional manual-entry escape hatch */}
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
            {onManual && (
              <button
                type="button"
                onClick={onManual}
                className="text-[13px] font-semibold"
                style={{ color: BRAND_GREEN }}
              >
                Enter it manually
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          aria-label="Add photo"
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-400"
        >
          <CameraIcon />
        </button>

        {/* Estimate CTA */}
        <button
          type="button"
          disabled={!value.trim()}
          onClick={handleSubmit}
          className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl text-[16px] font-semibold text-white transition-opacity disabled:opacity-40"
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
}: {
  estimate: MealEstimate
  onLog:    (meal: MealEstimate) => void
  onBack:   () => void
  // When true the user arrived via the manual path — calories and protein
  // start empty so they can type their own values rather than editing a 0.
  manual?:  boolean
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
    onLog({
      name:     name.trim() || estimate.name,
      calories: calorieVal,
      protein:  Math.max(0, parseInt(protein) || 0),
      carbs:    estimate.carbs,
      fat:      estimate.fat,
    })
  }

  return (
    <motion.div
      key="confirm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {/* Heading + Back */}
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[22px] font-bold text-gray-900">Looks right?</p>
        <button
          type="button"
          onClick={onBack}
          className="text-[16px] font-semibold"
          style={{ color: BRAND_GREEN }}
        >
          Back
        </button>
      </div>

      {/* Meal name — editable */}
      <div className="mb-4 border-b border-gray-100 pb-3">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-400">Meal</p>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full bg-transparent text-[18px] font-semibold text-gray-900 outline-none"
        />
      </div>

      {/* Calories + Protein — editable tiles.
          type="text" + inputMode="numeric" shows the iOS numeric keypad without
          number-input quirks (spinners, accepting "e" / "+" / "-"). */}
      <div className="mb-6 flex gap-3">
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

      {/* Log it — disabled until calories > 0 */}
      <motion.button
        type="button"
        onClick={handleLog}
        disabled={!canLog}
        className="h-14 w-full rounded-2xl text-[17px] font-semibold tracking-wide text-white transition-opacity disabled:opacity-40"
        style={{ backgroundColor: BRAND_GREEN }}
        whileTap={reduced || !canLog ? {} : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        Log it
      </motion.button>
    </motion.div>
  )
}

// ── AddMealSheet ───────────────────────────────────────────────────────────────
interface AddMealSheetProps {
  isOpen:    boolean
  onClose:   () => void
  onLogged?: () => void
}

export default function AddMealSheet({ isOpen, onClose, onLogged }: AddMealSheetProps) {
  const prefersReduced = useReducedMotion() ?? false

  const [state,          setState]          = useState<SheetState>('input')
  const [estimate,       setEstimate]       = useState<MealEstimate | null>(null)
  const [errorMsg,       setErrorMsg]       = useState<string | null>(null)
  // Preserved so the textarea is restored when we bounce back from estimating on error
  const [lastInput,      setLastInput]      = useState('')
  // true while the "Enter it manually" button should be visible on the input screen
  const [manualAllowed,  setManualAllowed]  = useState(false)
  // true when the user entered ConfirmState via the manual path (blanks the number fields)
  const [isManual,       setIsManual]       = useState(false)

  // Incremented on every new request and on close. Any in-flight promise
  // that resolves after the id has changed is silently discarded.
  const requestIdRef   = useRef(0)
  // Set to true in handleLog so onExitComplete knows to fire onLogged.
  const mealLoggedRef  = useRef(false)

  const resetAndClose = () => {
    requestIdRef.current += 1   // invalidate any in-flight estimate
    onClose()
    // State reset and onLogged callback are deferred to onExitComplete on the
    // outer AnimatePresence, which fires after the sheet spring finishes.
  }

  // Escape hatch: skip the estimate, go straight to ConfirmState so the user
  // can type their own numbers. Prefills the name from what they typed.
  const handleManual = () => {
    setEstimate({ name: lastInput, calories: 0, protein: 0, carbs: 0, fat: 0 })
    setIsManual(true)
    setManualAllowed(false)
    setErrorMsg(null)
    setState('confirm')
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

    setLastInput(text)
    setErrorMsg(null)
    setManualAllowed(false)
    setState('estimating')

    // Capture the id before the await. If it no longer matches after the
    // promise settles, the sheet was closed while the request was in flight.
    requestIdRef.current += 1
    const thisId = requestIdRef.current

    try {
      const result = await estimateMeal(text)

      if (requestIdRef.current !== thisId) return   // sheet closed — discard

      // ── Model says "not a meal" ────────────────────────────────────────────
      if (!result.valid) {
        setState('input')
        setErrorMsg("Hmm, that doesn't look like a meal — mind describing what you ate?")
        setManualAllowed(true)
        return
      }

      // ── Valid estimate ─────────────────────────────────────────────────────
      setEstimate({
        name:     result.name,
        calories: result.calories,
        protein:  result.protein,
        carbs:    result.carbs,
        fat:      result.fat,
      })
      setState('confirm')

    } catch (err) {
      if (requestIdRef.current !== thisId) return   // sheet closed — discard
      console.error(`${SHEET_TAG} estimate failed:`, err)
      setState('input')
      setErrorMsg(friendlyMessage(err))
      setManualAllowed(true)
    }
  }

  const handleLog = (meal: MealEstimate) => {
    addMeal(meal)
    mealLoggedRef.current = true   // onExitComplete will fire onLogged after sheet exits
    resetAndClose()
  }

  const handleBack = () => {
    setState('input')
    setEstimate(null)
    setErrorMsg(null)
    setManualAllowed(false)
    setIsManual(false)
  }

  const handleExitComplete = () => {
    // Reset all internal state once the sheet is fully off screen.
    setState('input')
    setEstimate(null)
    setErrorMsg(null)
    setLastInput('')
    setManualAllowed(false)
    setIsManual(false)
    // Fire the "meal was logged" callback now that the plate is visible.
    if (mealLoggedRef.current) {
      mealLoggedRef.current = false
      onLogged?.()
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
                  onManual={manualAllowed ? handleManual : null}
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
                />
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
