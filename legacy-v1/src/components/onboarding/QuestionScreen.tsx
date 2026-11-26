import { motion, useReducedMotion } from 'framer-motion'
import OptionCard from './OptionCard'

const BRAND_GREEN = '#1C7C2E'

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = (current / total) * 100
  return (
    <div className="relative h-6 w-full">
      <div className="absolute inset-x-0 top-1/2 h-[7px] -translate-y-1/2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: BRAND_GREEN }}
        />
      </div>
      <div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-2 py-[3px] text-[10px] font-bold text-white"
        style={{
          backgroundColor: BRAND_GREEN,
          left: `clamp(18px, ${pct}%, calc(100% - 18px))`,
        }}
      >
        {current}/{total}
      </div>
    </div>
  )
}

// ── Info icon (circle-i) ──────────────────────────────────────────────────────
function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="6" stroke="#9ca3af" strokeWidth="1.2" />
      <rect x="6.25" y="5.75" width="1.5" height="4.75" rx="0.75" fill="#9ca3af" />
      <rect x="6.25" y="3.25" width="1.5" height="1.5" rx="0.75" fill="#9ca3af" />
    </svg>
  )
}

// ── Public API ─────────────────────────────────────────────────────────────────
// Reusable full-screen layout for every single-select onboarding question screen.
//
// Usage example (screen 4):
//
//   import QuestionScreen from '../../components/onboarding/QuestionScreen'
//
//   const OPTIONS = ['Option A', 'Option B', 'Option C']
//
//   export default function MyScreen() {
//     const navigate = useNavigate()
//     const { update } = useOnboarding()
//     const [selected, setSelected] = useState<string | null>(null)
//     return (
//       <QuestionScreen
//         step={4}
//         section="Section heading"
//         question="Your question here?"
//         options={OPTIONS}
//         selected={selected}
//         onSelect={setSelected}
//         onContinue={() => { update({ myField: selected }); navigate('/onboarding/next') }}
//       />
//     )
//   }

export interface QuestionScreenProps {
  /** Current step number shown in the progress pill (e.g. 2) */
  step:       number
  /** Total number of steps — defaults to 9 */
  total?:     number
  /** Bold green section heading (e.g. "Activity level") */
  section:    string
  /** Question text rendered below the heading */
  question:   string
  /** List of option labels — order preserved */
  options:    string[]
  /** Currently selected option label, or null for nothing selected */
  selected:   string | null
  onSelect:   (value: string) => void
  onContinue: () => void
  /** Optional hint line with an info icon rendered above the Continue button */
  hint?:      string
}

export default function QuestionScreen({
  step,
  total = 9,
  section,
  question,
  options,
  selected,
  onSelect,
  onContinue,
  hint,
}: QuestionScreenProps) {
  const prefersReduced = useReducedMotion() ?? false

  return (
    <motion.div
      className="flex h-dvh w-full flex-col bg-white"
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {/* ── Header: progress + heading + question ── */}
      <div className="flex-shrink-0 px-5 pt-6 pb-3">
        <ProgressBar current={step} total={total} />
        <h1
          className="mt-5 text-[24px] font-bold leading-tight"
          style={{ color: BRAND_GREEN }}
        >
          {section}
        </h1>
        <p className="mt-2 text-[17px] font-normal leading-snug text-gray-900">
          {question}
        </p>
      </div>

      {/* ── Scrollable option list ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <div className="flex flex-col gap-3 pt-1">
          {options.map((opt, i) => (
            <OptionCard
              key={opt}
              label={opt}
              selected={selected === opt}
              onSelect={() => onSelect(opt)}
              index={i}
            />
          ))}
        </div>
      </div>

      {/* ── Optional hint + Continue button ── */}
      <div className="flex-shrink-0 px-5 pb-10 pt-2">
        {hint && (
          <div className="mb-3 flex items-center justify-center gap-1.5">
            <InfoIcon />
            <span className="text-[12px] text-gray-400">{hint}</span>
          </div>
        )}
        <button
          type="button"
          disabled={selected === null}
          onClick={onContinue}
          className="h-14 w-full rounded-2xl bg-[#1C7C2E] text-[17px] font-semibold tracking-wide text-white transition-opacity disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </motion.div>
  )
}
