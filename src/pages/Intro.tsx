import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'

const BG_GREEN = '#1C7C2E'
const PRIMARY_BG = '#A8E6A8'
const PRIMARY_TEXT = '#0F4D1A'

export default function Intro() {
  const navigate = useNavigate()
  const prefersReduced = useReducedMotion() ?? false

  const handleStartJourney = () => {
    localStorage.setItem('disc_intro_seen', '1')
    navigate('/onboarding/body-basics')
  }

  const handleExistingAccount = () => {
    navigate('/create-account?mode=login')
  }

  return (
    <motion.div
      className="relative flex min-h-dvh w-full flex-col overflow-hidden"
      style={{ backgroundColor: BG_GREEN }}
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Fruit — already tilted asset, smaller, stuck to bottom behind CTA */}
      <img
        src="/onboarding-fruit.png"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: 'auto',
          maxWidth: 'none',
          objectFit: 'contain',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Headline + subtext */}
      <div
        className="relative z-10 flex-shrink-0 px-6"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 56px)' }}
      >
        <h1
          className="m-0 text-[88px] font-extrabold tracking-tight text-white"
          style={{ lineHeight: 0.92 }}
        >
          <span className="block">eat.</span>
          <span className="block">type.</span>
          <span className="block">track.</span>
        </h1>
        <p
          className="mb-0 mt-3"
          style={{
            fontSize: 14,
            color: 'rgba(255,255,255,0.8)',
            lineHeight: 1.5,
          }}
        >
          Few questions ahead to set your targets
        </p>
      </div>

      {/* Spacer — illustration shows through */}
      <div className="relative z-0 min-h-0 flex-1" aria-hidden="true" />

      {/* CTAs — primary journey, secondary login */}
      <div
        className="relative z-10 flex flex-shrink-0 flex-col gap-3 px-6"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
      >
        <button
          type="button"
          onClick={handleStartJourney}
          className="flex h-[52px] w-full items-center justify-center rounded-2xl text-[16px] font-semibold"
          style={{
            backgroundColor: PRIMARY_BG,
            color: PRIMARY_TEXT,
            boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
          }}
        >
          Start my journey
        </button>
        <button
          type="button"
          onClick={handleExistingAccount}
          className="flex h-[52px] w-full items-center justify-center rounded-2xl border-[1.5px] text-[15px] font-medium text-white backdrop-blur-md"
          style={{
            borderColor: 'rgba(255,255,255,0.35)',
            backgroundColor: 'rgba(255,255,255,0.12)',
          }}
        >
          I already have an account
        </button>
      </div>
    </motion.div>
  )
}
