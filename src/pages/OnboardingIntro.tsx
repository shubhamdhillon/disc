import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'

const BRAND_GREEN = '#1C7C2E'

// Green star with two white quotation-mark blocks inside — matching the design.
// The two white rectangles represent the "let's talk / personalise" idea.
function StarIcon({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {/* 4-pointed star shape */}
      <path
        d="M50 5 C47 32 32 47 5 50 C32 53 47 68 50 95 C53 68 68 53 95 50 C68 47 53 32 50 5Z"
        fill={BRAND_GREEN}
      />
      {/* Left quotation mark block */}
      <rect x="33" y="43" width="12" height="15" rx="2.5" fill="rgba(255,255,255,0.92)" />
      {/* Right quotation mark block */}
      <rect x="55" y="43" width="12" height="15" rx="2.5" fill="rgba(255,255,255,0.92)" />
    </svg>
  )
}

export default function OnboardingIntro() {
  const navigate       = useNavigate()
  const prefersReduced = useReducedMotion() ?? false

  return (
    <motion.div
      className="flex h-dvh flex-col bg-white"
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {/* ── Centered content block: star above, card below ── */}
      {/* pb-20 nudges the block slightly below true center, matching the design */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-20">

        {/* Star — fades and rises gently into place */}
        <motion.div
          className="mb-5"
          initial={prefersReduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.45, ease: 'easeOut' }}
        >
          <StarIcon size={52} />
        </motion.div>

        {/* Card — hard offset shadow (no blur), light grey border */}
        <motion.div
          className="w-full rounded-2xl border border-gray-200 bg-white px-6 py-5"
          style={{ boxShadow: '4px 4px 0 0 rgba(0,0,0,0.13)' }}
          initial={prefersReduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24, duration: 0.45, ease: 'easeOut' }}
        >
          <h2
            className="m-0 text-[20px] font-bold leading-snug"
            style={{ color: '#1c1c1e' }}
          >
            Let's get to know you!
          </h2>
          <p className="mb-0 mt-2.5 text-[14px] leading-relaxed text-gray-500">
            Just a few questions to help us personalise this for you.
          </p>
        </motion.div>
      </div>

      {/* ── "Let's start" CTA ── */}
      <div className="flex-shrink-0 px-5 pb-10">
        <button
          type="button"
          onClick={() => navigate('/onboarding/body-basics')}
          className="h-14 w-full rounded-2xl text-[17px] font-semibold tracking-wide text-white"
          style={{ backgroundColor: BRAND_GREEN }}
        >
          Let's start
        </button>
      </div>
    </motion.div>
  )
}
