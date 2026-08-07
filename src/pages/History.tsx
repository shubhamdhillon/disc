import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  getMonthRecords,
  getMealsAndRecordForDate,
  type DailyRecord,
} from '../lib/dailyRecords'
import { fetchTargetsHistory, type TargetsResolver } from '../lib/targetsStore'
import { formatMealTime, type LoggedMeal } from '../lib/mealsStore'
import { computeDayVerdict } from '../lib/dayVerdict'
import QualityIcons from '../components/QualityIcons'

const BRAND_GREEN = '#1C7C2E'
const AMBER_RING  = '#E0A94A'
const AMBER_TEXT  = '#B9822E'
const BAD_RED     = '#E11D48'
const EMPTY_RING  = '#E8E8E6'
const LABEL_GREY  = '#B8BEB9'

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** Inner hue for static mini-thali glow — mirrors Today.tsx VERDICT_GLOW.inner */
const VERDICT_GLOW_INNER = {
  good: '5,150,105',
  warn: '217,119,6',
  bad:  '225,29,72',
} as const

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

function verdictRingColor(verdict: DailyRecord['verdict']): string {
  if (verdict === 'good') return BRAND_GREEN
  if (verdict === 'warn') return AMBER_RING
  if (verdict === 'bad') return BAD_RED
  return EMPTY_RING
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59)
}

function DaySheet({
  open,
  onClose,
  date,
  meals,
  record,
  loading,
}: {
  open: boolean
  onClose: () => void
  date: Date
  meals: LoggedMeal[]
  record: DailyRecord | null
  loading: boolean
}) {
  const prefersReduced = useReducedMotion() ?? false

  const dateLabel = date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const verdict = record?.verdict ?? null
  const verdictCopy =
    verdict === 'bad'  ? 'Rough day'
    : verdict === 'warn' ? 'Could be tighter'
    : verdict === 'good' ? 'Good day'
    : 'Nothing logged'
  const verdictColor =
    verdict === 'bad'  ? '#E11D48'
    : verdict === 'warn' ? '#D97706'
    : verdict === 'good' ? BRAND_GREEN
    : '#6B7280'

  const chronoMeals = useMemo(
    () => [...meals].sort((a, b) => a.timestamp - b.timestamp),
    [meals],
  )
  const slotCount = Math.max(6, chronoMeals.length)
  const positions = katoriPositions(slotCount)
  const sizePx = 32

  const dayVerdict = useMemo(() => {
    if (!record || meals.length === 0) return null
    return computeDayVerdict(meals, record.targetSnapshot, endOfDay(date))
  }, [meals, record, date])

  const glowRgb =
    verdict === 'good' || verdict === 'warn' || verdict === 'bad'
      ? VERDICT_GLOW_INNER[verdict]
      : VERDICT_GLOW_INNER.good

  const macroRows = record && dayVerdict
    ? ([
        {
          label: 'Protein',
          consumed: record.totalProtein,
          target: record.targetSnapshot.protein,
          status: dayVerdict.protein,
          colourStatus: true,
        },
        {
          label: 'Carbs',
          consumed: record.totalCarbs,
          target: record.targetSnapshot.carbs,
          status: 'fine' as const,
          colourStatus: false,
        },
        {
          label: 'Fat',
          consumed: record.totalFat,
          target: record.targetSnapshot.fat,
          status: dayVerdict.fat,
          colourStatus: true,
        },
      ] as const)
    : []

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(17,24,39,0.35)', touchAction: 'none' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 overflow-y-auto rounded-t-[28px] bg-white px-4 pt-6"
            style={{
              maxHeight: '85svh',
              paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
            }}
            initial={prefersReduced ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280, mass: 0.9 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 400) onClose()
            }}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="mx-auto mb-5 flex w-full items-center justify-center"
            >
              <span
                className="block rounded-full"
                style={{ width: 36, height: 4, backgroundColor: '#E5E7EB' }}
              />
            </button>

            {loading || !record ? (
              <p className="py-10 text-center text-[15px] text-gray-400">Loading…</p>
            ) : (
              <>
                <div className="mb-6">
                  <p className="text-[13px]" style={{ color: '#9CA3AF' }}>
                    {dateLabel}
                  </p>
                  <p
                    className="mt-1 text-[24px] font-bold tracking-tight leading-snug"
                    style={{ color: verdictColor }}
                  >
                    {verdictCopy}
                  </p>
                </div>

                {meals.length === 0 ? (
                  <p className="py-10 text-center text-[14px] text-gray-500">
                    Nothing logged this day
                  </p>
                ) : (
                  <>
                    {/* Mini thali */}
                    <div className="relative mx-auto mb-6 aspect-square w-[180px]">
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute rounded-full"
                        style={{
                          inset: '-8%',
                          filter: 'blur(20px)',
                          background: `radial-gradient(circle at 46% 42%, rgba(${glowRgb},0.35) 0%, transparent 66%)`,
                        }}
                      />
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full"
                        style={{
                          backgroundColor: '#FDFDFC',
                          border: '1px solid rgba(0,0,0,0.05)',
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center rounded-full">
                        {positions.map((pos, i) => {
                          const meal = chronoMeals[i]
                          const tier = meal ? mealTier(meal) : null
                          const colors = tier ? TIER_KATORI[tier] : null
                          return (
                            <div
                              key={i}
                              className="absolute"
                              style={{
                                top: pos.top,
                                left: pos.left,
                                transform: 'translate(-50%,-50%)',
                              }}
                            >
                              {meal && colors ? (
                                <div
                                  className="flex items-center justify-center rounded-full text-[11px] font-semibold"
                                  style={{
                                    width: sizePx,
                                    height: sizePx,
                                    backgroundColor: colors.fill,
                                    border: `1.5px solid ${colors.ring}`,
                                    color: colors.number,
                                  }}
                                >
                                  {meal.calories}
                                </div>
                              ) : (
                                <div
                                  className="rounded-full"
                                  style={{
                                    width: sizePx,
                                    height: sizePx,
                                    border: '1.5px dashed #D1D5DB',
                                  }}
                                />
                              )}
                            </div>
                          )
                        })}
                        <div className="z-10 flex flex-col items-center px-10">
                          <p className="text-[26px] font-bold leading-none" style={{ color: '#0F172A' }}>
                            {record.totalCals.toLocaleString()}
                          </p>
                          <p className="mt-1 text-[11px]" style={{ color: '#9CA3AF' }}>
                            of {record.targetSnapshot.calories.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Coach */}
                    {dayVerdict && dayVerdict.coach.body && (
                      <div
                        className="mb-6 rounded-2xl p-4"
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #EEF0EE',
                        }}
                      >
                        <p className="text-[13px] leading-relaxed" style={{ color: '#374151' }}>
                          {dayVerdict.coach.body}
                        </p>
                      </div>
                    )}

                    {/* Macros */}
                    <div className="mb-8 flex flex-col gap-3">
                      {macroRows.map(row => {
                        const pct = Math.min(row.consumed / Math.max(row.target, 1), 1) * 100
                        const accent =
                          row.colourStatus && row.status === 'bad'  ? '#E11D48'
                          : row.colourStatus && row.status === 'warn' ? '#D97706'
                          : null
                        const fillColor = accent ?? '#D1D5DB'
                        const textColor = accent ?? '#111827'
                        return (
                          <div key={row.label}>
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="text-[12px]" style={{ color: '#9CA3AF' }}>
                                {row.label}
                              </span>
                              <span
                                className="text-[13px] font-semibold"
                                style={{ color: textColor }}
                              >
                                {row.consumed} / {row.target}g
                              </span>
                            </div>
                            <div
                              className="overflow-hidden rounded-full"
                              style={{ height: 5, backgroundColor: '#EDEFED' }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${pct}%`, backgroundColor: fillColor }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Meals */}
                    <p className="mb-3 text-[13px] font-semibold" style={{ color: '#6B7280' }}>
                      Meals
                    </p>
                    <div className="flex flex-col gap-2.5">
                      {chronoMeals.map(meal => {
                        const colors = TIER_KATORI[mealTier(meal)]
                        return (
                          <div
                            key={meal.id}
                            className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5"
                          >
                            <span
                              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: colors.ring }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <p className="truncate text-[14px] font-semibold" style={{ color: '#111827' }}>
                                  {meal.name}
                                </p>
                                <QualityIcons tags={meal.quality ?? []} size={14} />
                              </div>
                              <p className="mt-0.5 text-[12px]" style={{ color: '#9CA3AF' }}>
                                {formatMealTime(meal.timestamp)}
                              </p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <p className="text-[15px] font-semibold" style={{ color: '#111827' }}>
                                {meal.calories} cal
                              </p>
                              <p className="mt-0.5 text-[12px]" style={{ color: '#9CA3AF' }}>
                                {meal.protein}g protein
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default function History() {
  const navigate = useNavigate()
  const prefersReduced = useReducedMotion() ?? false

  const [resolver, setResolver] = useState<TargetsResolver | null>(null)
  const [records, setRecords] = useState<DailyRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [dayMeals, setDayMeals] = useState<LoggedMeal[]>([])
  const [dayRecord, setDayRecord] = useState<DailyRecord | null>(null)
  const [dayLoading, setDayLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const todayKey = toDateKey(today)
  const selectedKey = toDateKey(selectedDate)
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
  const leadingBlanks = new Date(viewYear, viewMonth, 1).getDay()
  const isCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth()

  // Lock the page scroll container while the sheet is open (iOS scroll competition)
  useEffect(() => {
    if (!sheetOpen) return
    const el = scrollRef.current
    if (!el) return
    const scrollTop = el.scrollTop
    const prevOverflow = el.style.overflow
    el.style.overflow = 'hidden'
    return () => {
      el.style.overflow = prevOverflow
      el.scrollTop = scrollTop
    }
  }, [sheetOpen])
  useEffect(() => {
    let active = true
    ;(async () => {
      const history = await fetchTargetsHistory()
      if (!active) return
      if (history.status === 'ok') {
        setResolver(history.resolver)
      } else {
        setLoading(false)
        setDayLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!resolver) return
    let active = true
    setLoading(true)
    ;(async () => {
      const monthRecords = await getMonthRecords(viewYear, viewMonth, resolver)
      if (!active) return
      setRecords(monthRecords)
      setLoading(false)
    })()
    return () => { active = false }
  }, [resolver, viewYear, viewMonth])

  useEffect(() => {
    if (!resolver) return
    let active = true
    setDayLoading(true)
    ;(async () => {
      const { meals, record } = await getMealsAndRecordForDate(selectedDate, resolver)
      if (!active) return
      setDayMeals(meals)
      setDayRecord(record)
      setDayLoading(false)
    })()
    return () => { active = false }
  }, [selectedDate, resolver])

  const goPrev = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const goNext = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const openDay = (dayDate: Date) => {
    setSelectedDate(dayDate)
    setSheetOpen(true)
  }

  return (
    <motion.div
      className="relative flex h-dvh w-full flex-col bg-white"
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Title bar — matches Settings */}
      <div
        className="flex-shrink-0 border-b border-gray-100 bg-white"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }}
      >
        <div className="flex h-12 items-center gap-2 px-3">
          <button
            type="button"
            aria-label="Back"
            onClick={() => navigate('/today')}
            className="flex h-10 w-10 items-center justify-center rounded-full"
          >
            <ChevronLeft size={22} strokeWidth={2} color="#111827" />
          </button>
          <h1 className="m-0 text-[17px] font-semibold text-gray-900">History</h1>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-4">
        {/* Month control — sits with the calendar */}
        <div className="flex items-center justify-between px-4 pb-4 pt-4">
          <h2
            className="m-0 text-[20px] font-bold tracking-tight"
            style={{ color: '#111827' }}
          >
            {monthLabel}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={goPrev}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: '#F5F6F5' }}
            >
              <ChevronLeft size={16} strokeWidth={2} color="#374151" />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={goNext}
              disabled={isCurrentMonth}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full disabled:opacity-30"
              style={{ backgroundColor: '#F5F6F5' }}
            >
              <ChevronRight size={16} strokeWidth={2} color="#374151" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center px-4 py-24">
            <p className="text-[15px] text-gray-400">Loading…</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-y-2 px-4">
            {DAY_LETTERS.map((letter, i) => (
              <div
                key={`letter-${i}`}
                className="flex items-center justify-center text-[11px]"
                style={{ color: LABEL_GREY }}
              >
                {letter}
              </div>
            ))}

            {Array.from({ length: leadingBlanks }, (_, i) => (
              <div key={`blank-${i}`} />
            ))}

            {records.map(record => {
              const isToday = record.date === todayKey
              const isFuture = record.date > todayKey
              const isSelected = sheetOpen && record.date === selectedKey
              const dayNum = Number(record.date.slice(-2))
              const dayDate = parseLocalDate(record.date)
              const ariaLabel = dayDate.toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })

              let circleStyle: React.CSSProperties
              let numberColor: string
              const ringColor = verdictRingColor(record.verdict)
              const borderWidth = isSelected && !isToday ? '2px' : '1.5px'

              if (isToday) {
                circleStyle = { backgroundColor: BRAND_GREEN }
                numberColor = '#FFFFFF'
              } else if (isFuture) {
                circleStyle = {
                  border: `1.5px solid ${EMPTY_RING}`,
                  opacity: 0.4,
                }
                numberColor = '#D1D5DB'
              } else if (record.verdict === 'good') {
                circleStyle = { border: `${borderWidth} solid ${BRAND_GREEN}` }
                numberColor = BRAND_GREEN
              } else if (record.verdict === 'warn') {
                circleStyle = { border: `${borderWidth} solid ${AMBER_RING}` }
                numberColor = AMBER_TEXT
              } else if (record.verdict === 'bad') {
                circleStyle = { border: `${borderWidth} solid ${BAD_RED}` }
                numberColor = BAD_RED
              } else {
                circleStyle = { border: `${borderWidth} solid ${ringColor}` }
                numberColor = '#9CA3AF'
              }

              const circle = (
                <div
                  className="flex items-center justify-center rounded-full text-[13px] font-semibold"
                  style={{
                    width: 36,
                    height: 36,
                    color: numberColor,
                    ...circleStyle,
                  }}
                >
                  {dayNum}
                </div>
              )

              if (isFuture) {
                return (
                  <div key={record.date} className="flex items-center justify-center">
                    {circle}
                  </div>
                )
              }

              return (
                <div key={record.date} className="flex items-center justify-center">
                  <button
                    type="button"
                    aria-label={ariaLabel}
                    aria-pressed={isSelected}
                    onClick={() => openDay(dayDate)}
                    className="flex items-center justify-center"
                  >
                    {circle}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <DaySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        date={selectedDate}
        meals={dayMeals}
        record={dayRecord}
        loading={dayLoading}
      />
    </motion.div>
  )
}
