import { useState, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { estimateMeal } from '../lib/estimateMeal'
import { addMeal } from '../lib/mealsStore'
import type { MealEstimate } from '../lib/estimateMeal'

const BRAND_GREEN = '#1C7C2E'

type SheetState = 'input' | 'estimating' | 'confirm'

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
function InputState({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [value, setValue] = useState('')
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

      {/* Actions */}
      <div className="mt-4 flex gap-3">
        {/* Camera button — UI wired, action is placeholder */}
        <button
          type="button"
          aria-label="Add photo"
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-400"
          onClick={() => {/* TODO: photo picker */}}
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
// All three values are inline-editable before logging.
function ConfirmState({
  estimate,
  onLog,
  onBack,
}: {
  estimate: MealEstimate
  onLog:    (meal: MealEstimate) => void
  onBack:   () => void
}) {
  const [name,     setName]     = useState(estimate.name)
  const [calories, setCalories] = useState(String(estimate.calories))
  const [protein,  setProtein]  = useState(String(estimate.protein))

  const handleLog = () => {
    onLog({
      name:     name.trim() || estimate.name,
      calories: Math.max(0, parseInt(calories) || 0),
      protein:  Math.max(0, parseInt(protein)  || 0),
      // Carbs and fat are not shown as editable fields to keep the UI focused;
      // the estimate values are carried through. Future: add a detail toggle.
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
      {/* Heading + back link */}
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[22px] font-bold text-gray-900">Looks right?</p>
        <button
          type="button"
          onClick={onBack}
          className="text-[13px] font-medium text-gray-400"
        >
          ← Edit
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

      {/* Calories + Protein — editable tiles */}
      <div className="mb-6 flex gap-3">
        <div className="flex flex-1 flex-col items-center rounded-2xl bg-gray-50 px-4 py-4">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">Calories</p>
          <input
            type="number"
            inputMode="numeric"
            value={calories}
            onChange={e => setCalories(e.target.value)}
            className="w-full bg-transparent text-center text-[32px] font-bold leading-none text-gray-900 outline-none"
          />
          <p className="mt-1 text-[12px] text-gray-400">kcal</p>
        </div>
        <div className="flex flex-1 flex-col items-center rounded-2xl bg-gray-50 px-4 py-4">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">Protein</p>
          <input
            type="number"
            inputMode="numeric"
            value={protein}
            onChange={e => setProtein(e.target.value)}
            className="w-full bg-transparent text-center text-[32px] font-bold leading-none text-gray-900 outline-none"
          />
          <p className="mt-1 text-[12px] text-gray-400">grams</p>
        </div>
      </div>

      {/* Log it */}
      <button
        type="button"
        onClick={handleLog}
        className="h-14 w-full rounded-2xl text-[17px] font-semibold tracking-wide text-white"
        style={{ backgroundColor: BRAND_GREEN }}
      >
        Log it
      </button>
    </motion.div>
  )
}

// ── AddMealSheet ───────────────────────────────────────────────────────────────
interface AddMealSheetProps {
  isOpen:  boolean
  onClose: () => void
  /** Called after a meal is successfully logged so Today can refresh. */
  onLogged?: () => void
}

export default function AddMealSheet({ isOpen, onClose, onLogged }: AddMealSheetProps) {
  const prefersReduced = useReducedMotion() ?? false

  const [state,    setState]    = useState<SheetState>('input')
  const [estimate, setEstimate] = useState<MealEstimate | null>(null)

  const resetAndClose = () => {
    onClose()
    // Defer state reset so it doesn't flash during the exit animation
    setTimeout(() => {
      setState('input')
      setEstimate(null)
    }, 350)
  }

  const handleSubmit = async (text: string) => {
    setState('estimating')
    const result = await estimateMeal(text)
    setEstimate(result)
    setState('confirm')
  }

  const handleLog = (meal: MealEstimate) => {
    addMeal(meal)
    onLogged?.()
    resetAndClose()
  }

  const handleBack = () => {
    setState('input')
    setEstimate(null)
  }

  return (
    <AnimatePresence>
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
                <InputState key="input" onSubmit={handleSubmit} />
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
                />
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
