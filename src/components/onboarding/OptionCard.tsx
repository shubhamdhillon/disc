import { motion } from 'framer-motion'

interface OptionCardProps {
  label:    string
  selected: boolean
  onSelect: () => void
  /** Zero-based position in the list — drives the mount stagger delay */
  index:    number
}

export default function OptionCard({ label, selected, onSelect, index }: OptionCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 + index * 0.05, duration: 0.28, ease: 'easeOut' }}
      whileTap={{ scale: 0.98 }}
      className={[
        'w-full rounded-2xl px-4 py-4 text-left text-[15px] transition-colors duration-150',
        selected
          ? 'border-2 border-[#1C7C2E] bg-green-50 font-medium text-[#1C7C2E]'
          : 'border border-gray-200 bg-white font-normal text-gray-800',
      ].join(' ')}
    >
      {label}
    </motion.button>
  )
}
