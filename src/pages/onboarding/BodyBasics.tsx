import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import WheelPicker from '../../components/WheelPicker'
import { useOnboarding } from '../../context/OnboardingContext'

const BRAND_GREEN = '#1C7C2E'

// ── Value arrays ───────────────────────────────────────────────────────────────

const DAYS   = Array.from({ length: 31 }, (_, i) => i + 1)
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const YEARS  = Array.from({ length: 61 }, (_, i) => 1950 + i)  // 1950–2010
const HEIGHTS= Array.from({ length: 101 }, (_, i) => 120 + i)  // 120–220 cm

// Weight 30–200 kg in 0.5-kg steps.
// Integers display as "70" (no ".0"), non-integers as "70.5".
const WEIGHTS = Array.from({ length: 341 }, (_, i) => {
  const v = 30 + i * 0.5
  return v % 1 === 0 ? String(v) : v.toFixed(1)
})

// ── Default picker indices ─────────────────────────────────────────────────────
const DEFAULT_DAY_IDX    = 16   // day 17
const DEFAULT_MONTH_IDX  = 9    // October
const DEFAULT_YEAR_IDX   = 48   // 1950 + 48 = 1998
const DEFAULT_HEIGHT_IDX = 52   // 120 + 52 = 172
const DEFAULT_WEIGHT_IDX = 80   // 30 + 80×0.5 = 70.0

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = (current / total) * 100
  return (
    <div className="relative h-6 w-full">
      {/* Track */}
      <div className="absolute inset-x-0 top-1/2 h-[5px] -translate-y-1/2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: BRAND_GREEN }}
        />
      </div>
      {/* Pill — centered on the filled/unfilled boundary */}
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

// ── Section label ─────────────────────────────────────────────────────────────
// Small grey label, normal case — matches design (not uppercase/tracking-wide)
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 mt-0 text-[13px] font-normal text-gray-400">{children}</p>
  )
}

// ── Picker container ──────────────────────────────────────────────────────────
// White background, subtle grey border — used for both Age and Height/Weight.
function PickerBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {children}
    </div>
  )
}

// Thin hairline divider between picker columns
function PickerDivider() {
  return <div className="w-px self-stretch bg-gray-100" />
}

// ── Gender pill ───────────────────────────────────────────────────────────────
type Gender = 'male' | 'female' | 'other'

function GenderPill({
  label, value, selected, onSelect,
}: {
  label: string; value: Gender; selected: boolean; onSelect: (v: Gender) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={[
        'flex-1 rounded-full py-2.5 text-[14px] transition-colors',
        selected
          ? 'border-2 border-[#1C7C2E] bg-green-50 font-semibold text-[#1C7C2E]'
          : 'border border-gray-200 bg-white font-medium text-gray-500',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function BodyBasics() {
  const navigate       = useNavigate()
  const { update }     = useOnboarding()
  const prefersReduced = useReducedMotion() ?? false

  const [gender,    setGender]    = useState<Gender | null>(null)
  const [dayIdx,    setDayIdx]    = useState(DEFAULT_DAY_IDX)
  const [monthIdx,  setMonthIdx]  = useState(DEFAULT_MONTH_IDX)
  const [yearIdx,   setYearIdx]   = useState(DEFAULT_YEAR_IDX)
  const [heightIdx, setHeightIdx] = useState(DEFAULT_HEIGHT_IDX)
  const [weightIdx, setWeightIdx] = useState(DEFAULT_WEIGHT_IDX)

  const handleContinue = () => {
    update({
      gender,
      birthDay:   DAYS[dayIdx]      as number,
      birthMonth: monthIdx + 1,
      birthYear:  YEARS[yearIdx]    as number,
      heightCm:   HEIGHTS[heightIdx] as number,
      weightKg:   parseFloat(WEIGHTS[weightIdx]),
    })
    // TODO: swap '/today' for the next onboarding route when screen 2 is built
    navigate('/today')
  }

  return (
    <motion.div
      className="flex h-dvh flex-col bg-white"
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-5 pt-12 pb-3">
        <ProgressBar current={1} total={9} />
        <h1
          className="mt-5 text-[24px] font-bold leading-tight"
          style={{ color: BRAND_GREEN }}
        >
          Body basics
        </h1>
      </div>

      {/* ── Scrollable form ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">

        {/* Gender */}
        <div className="mb-5">
          <SectionLabel>Gender</SectionLabel>
          <div className="flex gap-2">
            <GenderPill label="Male"   value="male"   selected={gender === 'male'}   onSelect={setGender} />
            <GenderPill label="Female" value="female" selected={gender === 'female'} onSelect={setGender} />
            <GenderPill label="Others" value="other"  selected={gender === 'other'}  onSelect={setGender} />
          </div>
        </div>

        {/* Age — Day / Month / Year in one shared white box */}
        <div className="mb-5">
          <SectionLabel>Age</SectionLabel>
          <PickerBox>
            <div className="flex-1">
              <WheelPicker values={DAYS}   defaultIndex={DEFAULT_DAY_IDX}   onChange={setDayIdx}   label="Day" />
            </div>
            <PickerDivider />
            <div className="flex-1">
              <WheelPicker values={MONTHS} defaultIndex={DEFAULT_MONTH_IDX} onChange={setMonthIdx} label="Month" />
            </div>
            <PickerDivider />
            <div className="flex-1">
              <WheelPicker values={YEARS}  defaultIndex={DEFAULT_YEAR_IDX}  onChange={setYearIdx}  label="Year" />
            </div>
          </PickerBox>
        </div>

        {/* Height & Weight — two SEPARATE boxes, labels sit outside/above each box */}
        <div className="mb-6 flex gap-3">
          <div className="flex-1">
            <SectionLabel>Height(cm)</SectionLabel>
            <PickerBox>
              <div className="w-full">
                {/* label="" hides the internal column label — the section label above is used instead */}
                <WheelPicker values={HEIGHTS} defaultIndex={DEFAULT_HEIGHT_IDX} onChange={setHeightIdx} label="" />
              </div>
            </PickerBox>
          </div>
          <div className="flex-1">
            <SectionLabel>Weight(kg)</SectionLabel>
            <PickerBox>
              <div className="w-full">
                <WheelPicker values={WEIGHTS} defaultIndex={DEFAULT_WEIGHT_IDX} onChange={setWeightIdx} label="" />
              </div>
            </PickerBox>
          </div>
        </div>

      </div>

      {/* ── Continue button ── */}
      <div className="flex-shrink-0 px-5 pb-10 pt-2">
        <button
          type="button"
          onClick={handleContinue}
          className="h-14 w-full rounded-2xl text-[17px] font-semibold tracking-wide text-white"
          style={{ backgroundColor: BRAND_GREEN }}
        >
          Continue
        </button>
      </div>
    </motion.div>
  )
}
