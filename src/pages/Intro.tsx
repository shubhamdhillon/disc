import { useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'

const BRAND_GREEN = '#1C7C2E'

// Same star as Splash, semi-transparent on the gradient background
function StarIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path
        d="M50 5 C47 32 32 47 5 50 C32 53 47 68 50 95 C53 68 68 53 95 50 C68 47 53 32 50 5Z"
        fill="rgba(255,255,255,0.65)"
      />
    </svg>
  )
}

export default function Intro() {
  const navigate = useNavigate()
  const prefersReduced = useReducedMotion() ?? false

  // Check on mount only (useMemo with empty deps runs once per mount)
  const hasSeen = useMemo(() => !!localStorage.getItem('disc_intro_seen'), [])

  // If already seen, skip straight to onboarding with no flash
  useEffect(() => {
    if (hasSeen) navigate('/onboarding', { replace: true })
  }, [hasSeen, navigate])

  if (hasSeen) return null

  const handleContinue = () => {
    localStorage.setItem('disc_intro_seen', '1')
    navigate('/onboarding')
  }

  return (
    <motion.div
      className="flex h-dvh flex-col bg-white"
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* ── Gradient image placeholder ── */}
      {/* Rounded rectangle with a soft multi-tone green gradient.
          Swap this div's contents for a real <img> or <video> later. */}
      <div className="flex-shrink-0 px-4 pt-4">
        <div
          className="flex w-full items-center justify-center overflow-hidden rounded-[28px]"
          style={{
            aspectRatio: '1 / 1',
            background: `
              radial-gradient(ellipse at 22% 22%, rgba(200, 242, 170, 0.85) 0%, transparent 55%),
              radial-gradient(ellipse at 72% 68%, rgba(120, 220, 112, 0.70) 0%, transparent 48%),
              linear-gradient(145deg, #aae890 0%, #5ecb6a 48%, #39ae58 100%)
            `,
          }}
        >
          <StarIcon size={50} />
        </div>
      </div>

      {/* ── Copy ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-6 text-center">
        <h1
          className="m-0 text-[28px] font-extrabold leading-tight tracking-tight"
          style={{ color: '#1c1c1e' }}
        >
          Small habits,<br />zero friction
        </h1>

        <p className="mx-auto mb-0 mt-4 max-w-[272px] text-[15px] font-normal leading-relaxed text-gray-500">
          Just tell Disc what you ate, a photo or a few words. It figures out
          the rest and shows you your day at a glance.
        </p>
      </div>

      {/* ── CTA button ── */}
      {/* pb-10 gives breathing room on most phones; add env(safe-area-inset-bottom) if building for native shell */}
      <div className="flex-shrink-0 px-4 pb-10">
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
