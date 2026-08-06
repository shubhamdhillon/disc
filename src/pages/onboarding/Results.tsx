import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useOnboarding } from '../../context/OnboardingContext'
import type { OnboardingData } from '../../context/OnboardingContext'
import type { Targets } from '../../lib/calculateTargets'

const BRAND_GREEN = '#1C7C2E'

// ── Plain star (no quote marks — this is a neutral progress moment) ───────────
function StarIcon({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path
        d="M50 5 C47 32 32 47 5 50 C32 53 47 68 50 95 C53 68 68 53 95 50 C68 47 53 32 50 5Z"
        fill={BRAND_GREEN}
      />
    </svg>
  )
}

// ── Count-up animation hook ───────────────────────────────────────────────────
// Ticks from 0 → target over durationMs using a cubic ease-out curve.
// When run=false (prefers-reduced-motion), returns the final value immediately.
function useCountUp(target: number, durationMs: number, run: boolean): number {
  const [val, setVal] = useState(run ? 0 : target)
  useEffect(() => {
    if (!run) { setVal(target); return }
    let start = -1
    let id: number
    const tick = (ts: number) => {
      if (start < 0) start = ts
      const p     = Math.min((ts - start) / durationMs, 1)
      const eased = 1 - (1 - p) ** 3   // cubic ease-out
      setVal(Math.round(eased * target))
      if (p < 1) id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [target, durationMs, run])
  return val
}

// ── Reasoning sentence ────────────────────────────────────────────────────────
// Builds a human-readable sentence from the answers collected during onboarding.
function buildReasoning(data: OnboardingData): string {
  const parts: string[] = []

  if (data.workDay) {
    const MAP: Record<string, string> = {
      'Mostly sitting':            'a mostly-sitting day',
      'Mix of sitting and moving': 'a mixed-activity day',
      'On feet most of the day':   'an active day on your feet',
      'Physical work':             'a physically demanding day',
    }
    parts.push(MAP[data.workDay] ?? data.workDay.toLowerCase())
  }

  if (data.workoutFrequency === 'No') {
    parts.push('no structured training')
  } else if (data.workoutFrequency) {
    parts.push(`training ${data.workoutFrequency}`)
  }

  if (data.goal) {
    const MAP: Record<string, string> = {
      'Lose fat':           'a fat-loss goal',
      'Maintain':           'a maintenance goal',
      'Build muscle':       'a muscle-building goal',
      'Body recomposition': 'a recomposition goal',
    }
    parts.push(MAP[data.goal] ?? data.goal.toLowerCase())
  }

  if (parts.length === 0) return 'Based on your answers.'
  if (parts.length === 1) return `Based on your body and ${parts[0]}.`
  const last = parts[parts.length - 1]
  const rest = parts.slice(0, -1)
  return `Based on your body, ${rest.join(', ')}, and ${last}.`
}

// ── Processing phase ──────────────────────────────────────────────────────────
const MESSAGES = ['Reading your answers…', 'Balancing your day…', 'Almost there…']

function ProcessingView({ msgIdx }: { msgIdx: number }) {
  return (
    <motion.div
      className="flex flex-1 flex-col items-center justify-center gap-7"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Star rotates slowly — calm, not frantic */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      >
        <StarIcon size={52} />
      </motion.div>

      {/* Message cross-fades every 700 ms */}
      <AnimatePresence mode="wait">
        <motion.p
          key={msgIdx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="text-[15px] font-medium text-gray-400"
        >
          {MESSAGES[msgIdx]}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  )
}

// ── Single macro tile ─────────────────────────────────────────────────────────
function MacroTile({
  label, value, unit, delay, doAnimate,
}: {
  label: string; value: number; unit: string; delay: number; doAnimate: boolean
}) {
  const display = useCountUp(value, 700, doAnimate)
  return (
    <motion.div
      className="flex flex-1 flex-col items-center gap-0.5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
    >
      <p className="text-[27px] font-bold leading-none text-gray-900">
        {display.toLocaleString()}
        <span className="ml-0.5 text-[12px] font-normal text-gray-400">{unit}</span>
      </p>
      <p className="mt-0.5 text-[12px] font-medium text-gray-500">{label}</p>
    </motion.div>
  )
}

// ── Reveal phase ──────────────────────────────────────────────────────────────
function RevealView({
  data, targets, onStart, doAnimate,
}: {
  data:      OnboardingData
  targets:   Targets
  onStart:   () => void
  doAnimate: boolean
}) {
  const calories = useCountUp(targets.calories, 900, doAnimate)

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="flex-1 overflow-y-auto px-5 pb-4">

        {/* Heading */}
        <motion.div
          className="pt-10"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0, duration: 0.45, ease: 'easeOut' }}
        >
          <h1 className="text-[30px] font-bold leading-tight text-gray-900">
            Here's your day
          </h1>
          <p className="mt-1 text-[14px] text-gray-400">
            Your personalised daily targets
          </p>
        </motion.div>

        {/* Hero — big calorie number */}
        <motion.div
          className="mt-10 flex flex-col items-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.45, ease: 'easeOut' }}
        >
          <p
            className="text-[68px] font-bold leading-none tracking-tight"
            style={{ color: BRAND_GREEN }}
          >
            {calories.toLocaleString()}
          </p>
          <p className="mt-1.5 text-[14px] font-medium text-gray-400">kcal / day</p>
        </motion.div>

        {/* Divider */}
        <motion.div
          className="mt-8 h-px w-full bg-gray-100"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.28, duration: 0.3 }}
        />

        {/* Macro row */}
        <div className="mt-7 flex">
          <MacroTile label="Protein" value={targets.protein} unit="g" delay={0.36} doAnimate={doAnimate} />
          <div className="mx-2 w-px self-stretch bg-gray-100" />
          <MacroTile label="Carbs"   value={targets.carbs}   unit="g" delay={0.44} doAnimate={doAnimate} />
          <div className="mx-2 w-px self-stretch bg-gray-100" />
          <MacroTile label="Fat"     value={targets.fat}     unit="g" delay={0.52} doAnimate={doAnimate} />
        </div>

        {/* Reasoning */}
        <motion.p
          className="mt-8 text-[13px] leading-relaxed text-gray-400"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.62, duration: 0.4, ease: 'easeOut' }}
        >
          {buildReasoning(data)}
        </motion.p>
      </div>

      {/* CTA */}
      <motion.div
        className="flex-shrink-0 px-5 pb-10 pt-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.72, duration: 0.4, ease: 'easeOut' }}
      >
        <button
          type="button"
          onClick={onStart}
          className="h-14 w-full rounded-2xl text-[17px] font-semibold tracking-wide text-white"
          style={{ backgroundColor: BRAND_GREEN }}
        >
          Start tracking
        </button>
      </motion.div>
    </motion.div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function Results() {
  const navigate       = useNavigate()
  const { data }       = useOnboarding()
  const prefersReduced = useReducedMotion() ?? false

  // Targets come from context (set by FoodPrep just before navigation).
  // localStorage is a fallback for a hard refresh at this route.
  const stored  = localStorage.getItem('disc_targets')
  const targets = (data.targets ?? (stored ? JSON.parse(stored) : null)) as Targets | null

  // Skip processing animation when motion is reduced
  const [phase,  setPhase]  = useState<'processing' | 'reveal'>(
    prefersReduced ? 'reveal' : 'processing',
  )
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    if (phase !== 'processing') return
    // Message 1 → 700 ms, Message 2 → 1400 ms, reveal → 2200 ms
    const t1 = setTimeout(() => setMsgIdx(1), 700)
    const t2 = setTimeout(() => setMsgIdx(2), 1400)
    const t3 = setTimeout(() => setPhase('reveal'), 2200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [phase])

  if (!targets) return null

  return (
    <motion.div
      className="flex h-dvh w-full flex-col bg-white"
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <AnimatePresence mode="wait">
        {phase === 'processing' ? (
          <ProcessingView key="processing" msgIdx={msgIdx} />
        ) : (
          <RevealView
            key="reveal"
            data={data}
            targets={targets}
            onStart={() => navigate('/create-account')}
            doAnimate={!prefersReduced}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
