import { Leaf, Candy, Flame, Package, CupSoda, type LucideIcon } from 'lucide-react'

interface TagMeta {
  icon:  LucideIcon
  color: string
  label: string
}

const TAG_MAP: Record<string, TagMeta> = {
  whole:     { icon: Leaf,    color: '#1C7C2E', label: 'Whole food' },
  sugary:    { icon: Candy,   color: '#C4623D', label: 'Sugary' },
  fried:     { icon: Flame,   color: '#C4623D', label: 'Fried' },
  processed: { icon: Package, color: '#C4623D', label: 'Processed' },
  drink:     { icon: CupSoda, color: '#5B7A99', label: 'Drink' },
}

export default function QualityIcons({
  tags,
  size = 15,
}: {
  tags?:  string[] | null
  size?:  number
}) {
  if (!tags || tags.length === 0) return null

  const known = tags.filter(tag => {
    if (TAG_MAP[tag]) return true
    if (import.meta.env.DEV) console.warn('[QualityIcons] unknown tag:', tag)
    return false
  })

  if (known.length === 0) return null

  return (
    <span className="inline-flex flex-shrink-0 items-center gap-1.5">
      {known.map(tag => {
        const { icon: Icon, color, label } = TAG_MAP[tag]
        return (
          <Icon
            key={tag}
            size={size}
            strokeWidth={1.8}
            color={color}
            aria-label={label}
          />
        )
      })}
    </span>
  )
}
