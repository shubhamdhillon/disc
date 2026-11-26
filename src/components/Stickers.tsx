/*
  Placeholder food stickers (flat shape + white die-cut border).
  The final ones come from the Gemini sticker set; swap by name.
*/

/** Mount once near the root: the white die-cut border every sticker uses. */
export function StickerDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="sticker-edge" x="-40%" y="-40%" width="180%" height="180%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="5" result="d" />
          <feFlood floodColor="#fff" />
          <feComposite in2="d" operator="in" result="w" />
          <feMerge>
            <feMergeNode in="w" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  )
}

export type StickerName = 'tomato' | 'lemon' | 'leaf'

export function Sticker({ name }: { name: StickerName }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <g filter="url(#sticker-edge)">
        {name === 'tomato' && (
          <>
            <circle cx="50" cy="56" r="34" fill="#FF6B57" />
            <circle cx="38" cy="44" r="8" fill="#FF9A8A" />
            <path d="M50 24 q-14 -12 -22 -4 q12 2 22 4 q10 -2 20 -8 q-10 -6 -20 8z" fill="#3DB25A" />
          </>
        )}
        {name === 'lemon' && (
          <>
            <circle cx="50" cy="50" r="36" fill="#FFD447" />
            <circle cx="50" cy="50" r="28" fill="#FFE98A" />
            <g stroke="#FFD447" strokeWidth="4" strokeLinecap="round">
              <line x1="50" y1="24" x2="50" y2="76" />
              <line x1="24" y1="50" x2="76" y2="50" />
              <line x1="32" y1="32" x2="68" y2="68" />
              <line x1="68" y1="32" x2="32" y2="68" />
            </g>
            <circle cx="50" cy="50" r="5" fill="#FFF6CC" />
          </>
        )}
        {name === 'leaf' && (
          <>
            <path d="M20 80 Q20 25 80 18 Q82 72 20 80Z" fill="#3DB25A" />
            <path d="M24 76 Q46 50 74 24" stroke="#1F7F3A" strokeWidth="5" fill="none" strokeLinecap="round" />
          </>
        )}
      </g>
    </svg>
  )
}
