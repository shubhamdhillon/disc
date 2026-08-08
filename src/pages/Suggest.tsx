import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'

export default function Suggest() {
  const navigate = useNavigate()
  const prefersReduced = useReducedMotion() ?? false

  return (
    <motion.div
      className="relative flex h-dvh w-full flex-col bg-white"
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
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
          <h1 className="m-0 text-[17px] font-semibold text-gray-900">What to eat</h1>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-[15px] text-gray-400">Suggestions coming soon</p>
      </div>
    </motion.div>
  )
}
