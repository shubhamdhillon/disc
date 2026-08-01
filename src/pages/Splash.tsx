import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'

// Sampled from the reference design
const BRAND_GREEN = '#1C7C2E'

// 4-pointed star drawn with cubic bezier curves.
// Each arm curves smoothly from tip to tip; the sides bow inward to create
// the characteristic pinched waist of a 4-pointed star.
function StarIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path
        d="M50 5 C47 32 32 47 5 50 C32 53 47 68 50 95 C53 68 68 53 95 50 C68 47 53 32 50 5Z"
        fill="white"
      />
    </svg>
  )
}

// Determine animation mode once on mount and freeze it.
// Returns 'full' (first session launch), 'simple' (repeat), or 'none' (reduced-motion).
// useState initializer runs once and React preserves the value in Strict Mode remounts.
function useSplashMode() {
  const prefersReduced = useReducedMotion() ?? false
  const [isFirst] = useState(() => !sessionStorage.getItem('disc_splash'))

  useEffect(() => {
    sessionStorage.setItem('disc_splash', '1')
  }, [])

  if (prefersReduced) return 'none' as const
  if (isFirst) return 'full' as const
  return 'simple' as const
}

export default function Splash() {
  const navigate = useNavigate()
  const mode = useSplashMode()

  // Timing:
  // full  → last element completes ~900ms + 600ms hold = navigate at 1500ms
  //          AnimatePresence exit fade adds ~200ms → total visible < 2s ✓
  // other → 400ms simple fade, then navigate
  const navDelay = mode === 'full' ? 1500 : 400

  useEffect(() => {
    const t = setTimeout(() => navigate('/intro', { replace: true }), navDelay)
    return () => clearTimeout(t)
  }, [navigate, navDelay])

  const isFull = mode === 'full'

  // 'simple' mode: the page wrapper fades in; individual elements appear instantly inside it.
  // 'none' mode: everything appears instantly with no animation at all.
  // 'full' mode: page wrapper is already opaque; individual elements stagger in.
  const wrapperInitial = { opacity: mode === 'simple' ? 0 : 1 }

  return (
    <motion.div
      className="relative flex h-dvh flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: BRAND_GREEN }}
      initial={wrapperInitial}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {/* ── Center group: star → wordmark → tagline ── */}
      <div className="flex flex-col items-center gap-2">

        {/* Star — spring scale + opacity fade */}
        <motion.div
          initial={isFull ? { opacity: 0, scale: 0.3 } : { opacity: 1, scale: 1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={
            isFull
              ? {
                  type: 'spring',
                  stiffness: 260,
                  damping: 20,
                  // Override the opacity leg to use an eased tween instead of spring
                  opacity: { duration: 0.35, ease: 'easeOut' },
                }
              : { duration: 0 }
          }
        >
          <StarIcon size={42} />
        </motion.div>

        {/* "Disc" wordmark — fade + rise 20px, 150ms after star */}
        <motion.h1
          className="m-0 select-none leading-none text-white tracking-tight"
          style={{ fontFamily: '"Gasoek One", sans-serif', fontSize: '80px', fontWeight: 400 }}
          initial={isFull ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            isFull ? { delay: 0.15, duration: 0.4, ease: 'easeOut' } : { duration: 0 }
          }
        >
          Disc
        </motion.h1>

        {/* Tagline — same fade-up, 100ms after wordmark */}
        <motion.p
          className="m-0 text-[15px] font-medium tracking-wide text-white/80"
          initial={isFull ? { opacity: 0, y: 16 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            isFull ? { delay: 0.25, duration: 0.35, ease: 'easeOut' } : { duration: 0 }
          }
        >
          Your daily discipline app
        </motion.p>
      </div>

      {/* ── "Designed to sustain" — fades in last ── */}
      <motion.p
        className="absolute bottom-8 m-0 text-sm tracking-wide text-white/70"
        initial={isFull ? { opacity: 0 } : { opacity: 1 }}
        animate={{ opacity: 1 }}
        transition={isFull ? { delay: 0.6, duration: 0.3 } : { duration: 0 }}
      >
        Designed to sustain
      </motion.p>
    </motion.div>
  )
}
