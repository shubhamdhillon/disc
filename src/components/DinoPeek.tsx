import { forwardRef, useImperativeHandle, useRef } from 'react'

export interface DinoPeekHandle {
  /** Start a random peek variant. Returns ms until fully ducked. */
  play: () => number
  cancel: () => void
}

interface DinoPeekProps {
  size?: number
  /** Mirror horizontally so the dino faces inward from the left corner. */
  mirrored?: boolean
}

type Variant = 'A' | 'B' | 'C' | 'D'

const REST = 'translateY(0%)'
const HIDDEN = 'translateY(110%)'

const DinoPeek = forwardRef<DinoPeekHandle, DinoPeekProps>(function DinoPeek(
  { size = 62, mirrored = false },
  ref,
) {
  const height = Math.round(size * 800 / 870)
  const rootRef = useRef<HTMLDivElement>(null)
  const tiltRef = useRef<SVGGElement>(null)
  const eyeRef = useRef<SVGGElement>(null)
  const pupilRef = useRef<SVGGElement>(null)

  const animsRef = useRef<Animation[]>([])
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clear = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    animsRef.current.forEach(a => {
      try { a.cancel() } catch { /* ignore */ }
    })
    animsRef.current = []
  }

  const resetTransforms = () => {
    if (rootRef.current) rootRef.current.style.transform = HIDDEN
    if (tiltRef.current) tiltRef.current.style.transform = 'rotate(0deg)'
    if (eyeRef.current) eyeRef.current.style.transform = 'scale(1)'
    if (pupilRef.current) pupilRef.current.style.transform = 'translate(0px, 0px) scale(1)'
  }

  useImperativeHandle(ref, () => ({
    play() {
      clear()
      resetTransforms()

      const root = rootRef.current
      const tilt = tiltRef.current
      const eye = eyeRef.current
      const pupil = pupilRef.current
      if (!root || !tilt || !eye || !pupil) return 0

      const track = (a: Animation | undefined) => {
        if (a) animsRef.current.push(a)
      }
      const at = (ms: number, fn: () => void) => {
        timersRef.current.push(setTimeout(fn, ms))
      }

      const blink = () => {
        track(eye.animate(
          [
            { transform: 'scaleY(1)' },
            { transform: 'scaleY(0.06)' },
            { transform: 'scaleY(1)' },
          ],
          { duration: 160, easing: 'ease-in-out' },
        ))
      }

      const duck = (from: string, duration: number) => {
        track(root.animate(
          [
            { transform: from },
            { transform: HIDDEN },
          ],
          { duration, fill: 'forwards', easing: 'cubic-bezier(.6,0,.9,.4)' },
        ))
      }

      const variants: Variant[] = ['A', 'B', 'C', 'D']
      const variant = variants[Math.floor(Math.random() * variants.length)]!

      if (variant === 'A') {
        // Curious ~2.4s
        track(root.animate(
          [
            { transform: HIDDEN },
            { transform: 'translateY(6%)', offset: 0.68, easing: 'cubic-bezier(.34,1.5,.5,1)' },
            { transform: REST },
          ],
          { duration: 620, fill: 'forwards', easing: 'cubic-bezier(.2,.8,.3,1)' },
        ))
        at(760, () => {
          track(tilt.animate(
            [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-8deg)' }],
            { duration: 340, fill: 'forwards', easing: 'cubic-bezier(.2,.9,.3,1)' },
          ))
        })
        at(900, () => {
          track(pupil.animate(
            [
              { transform: 'translate(0px, 0px) scale(1)' },
              { transform: 'translate(-26px, -14px) scale(1)' },
            ],
            { duration: 260, fill: 'forwards', easing: 'ease-out' },
          ))
        })
        at(1180, blink)
        at(1500, () => {
          track(tilt.animate(
            [{ transform: 'rotate(-8deg)' }, { transform: 'rotate(6deg)' }],
            { duration: 380, fill: 'forwards' },
          ))
        })
        at(1900, blink)
        at(2150, () => {
          track(pupil.animate(
            [
              { transform: 'translate(-26px, -14px) scale(1)' },
              { transform: 'translate(0px, 0px) scale(1)' },
            ],
            { duration: 240, fill: 'forwards' },
          ))
          track(tilt.animate(
            [{ transform: 'rotate(6deg)' }, { transform: 'rotate(0deg)' }],
            { duration: 280, fill: 'forwards' },
          ))
        })
        at(2400, () => duck(REST, 360))
        return 2760
      }

      if (variant === 'B') {
        // Quick check ~1.3s
        track(root.animate(
          [
            { transform: HIDDEN },
            { transform: REST },
          ],
          { duration: 380, fill: 'forwards', easing: 'cubic-bezier(.2,1.4,.4,1)' },
        ))
        at(460, blink)
        at(650, () => {
          track(pupil.animate(
            [
              { transform: 'translate(0px, 0px) scale(1)' },
              { transform: 'translate(20px, 8px) scale(1)' },
            ],
            { duration: 200, fill: 'forwards', easing: 'ease-out' },
          ))
        })
        at(900, () => {
          track(pupil.animate(
            [
              { transform: 'translate(20px, 8px) scale(1)' },
              { transform: 'translate(0px, 0px) scale(1)' },
            ],
            { duration: 200, fill: 'forwards' },
          ))
        })
        at(1100, () => duck(REST, 300))
        return 1400
      }

      if (variant === 'C') {
        // Hesitant ~2.8s
        track(root.animate(
          [
            { transform: HIDDEN },
            { transform: 'translateY(47%)' },
          ],
          { duration: 400, fill: 'forwards', easing: 'cubic-bezier(.2,.8,.3,1)' },
        ))
        // t=520 pause (hold at 47%)
        at(900, () => {
          track(root.animate(
            [
              { transform: 'translateY(47%)' },
              { transform: REST },
            ],
            { duration: 420, fill: 'forwards', easing: 'cubic-bezier(.2,.9,.3,1)' },
          ))
        })
        at(1400, () => {
          track(tilt.animate(
            [{ transform: 'rotate(0deg)' }, { transform: 'rotate(10deg)' }],
            { duration: 400, fill: 'forwards', easing: 'ease-out' },
          ))
        })
        at(1700, blink)
        at(2100, () => {
          track(tilt.animate(
            [{ transform: 'rotate(10deg)' }, { transform: 'rotate(0deg)' }],
            { duration: 280, fill: 'forwards' },
          ))
        })
        at(2500, () => duck(REST, 380))
        return 2880
      }

      // Variant D — startled ~1.8s
      track(root.animate(
        [
          { transform: HIDDEN },
          { transform: 'translateY(6%)', offset: 0.7, easing: 'cubic-bezier(.2,1.8,.4,1)' },
          { transform: REST },
        ],
        { duration: 240, fill: 'forwards', easing: 'cubic-bezier(.2,1.8,.4,1)' },
      ))
      track(pupil.animate(
        [
          { transform: 'translate(0px, 0px) scale(1)' },
          { transform: 'translate(0px, 0px) scale(0.5)' },
        ],
        { duration: 180, fill: 'forwards', easing: 'ease-out' },
      ))
      track(eye.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.12)' },
        ],
        { duration: 180, fill: 'forwards', easing: 'ease-out' },
      ))
      at(300, () => {
        track(tilt.animate(
          [{ transform: 'rotate(0deg)' }, { transform: 'rotate(12deg)' }],
          { duration: 220, fill: 'forwards', easing: 'ease-out' },
        ))
      })
      at(560, () => {
        track(tilt.animate(
          [{ transform: 'rotate(12deg)' }, { transform: 'rotate(-10deg)' }],
          { duration: 300, fill: 'forwards', easing: 'cubic-bezier(.3,.9,.3,1)' },
        ))
      })
      at(900, () => {
        track(pupil.animate(
          [
            { transform: 'translate(0px, 0px) scale(0.5)' },
            { transform: 'translate(0px, 0px) scale(1)' },
          ],
          { duration: 240, fill: 'forwards' },
        ))
        track(eye.animate(
          [
            { transform: 'scale(1.12)' },
            { transform: 'scale(1)' },
          ],
          { duration: 240, fill: 'forwards' },
        ))
        track(tilt.animate(
          [{ transform: 'rotate(-10deg)' }, { transform: 'rotate(0deg)' }],
          { duration: 240, fill: 'forwards' },
        ))
      })
      at(1200, blink)
      at(1600, () => duck(REST, 320))
      return 1920
    },

    cancel() {
      clear()
      resetTransforms()
    },
  }))

  return (
    <div
      ref={rootRef}
      style={{
        width: size,
        height,
        transform: HIDDEN,
        willChange: 'transform',
      }}
    >
      <svg
        viewBox="160 30 870 800"
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={height}
        aria-hidden="true"
        style={{
          display: 'block',
          overflow: 'visible',
          transform: mirrored ? 'scaleX(-1)' : 'none',
          transformOrigin: 'center',
        }}
      >
        <g ref={tiltRef} style={{ transformOrigin: '600px 830px' }}>
          <path
            fill="#1C7C2E"
            d="M168 424 C168 254 325 108 512 104 C566 103 616 110 660 124 C674 92 700 52 728 46 C748 42 758 68 764 96 C768 118 772 136 776 152 C812 126 862 130 890 154 C868 182 858 216 872 250 C910 258 946 276 962 302 C936 332 910 366 906 406 C940 416 970 434 976 460 C950 486 918 514 902 550 C932 564 956 582 962 606 C936 630 906 646 894 670 C918 684 938 700 942 722 C920 744 900 760 890 780 C900 792 910 800 916 812 L916 830 C916 856 908 882 892 884 C877 886 872 862 870 842 C866 866 856 888 840 888 C824 888 820 864 818 842 C814 866 804 886 788 886 C772 886 768 860 768 838 L768 830 L528 830 L528 700 C528 676 534 656 542 640 C500 650 442 648 400 632 C262 592 168 512 168 424 Z M345 782 C345 738 381 702 425 702 C469 702 505 738 505 782 C505 800 500 816 491 830 C489 856 478 882 465 880 C453 878 449 854 447 836 C441 864 430 888 417 888 C405 888 400 862 398 842 C390 868 379 890 366 888 C354 886 351 858 351 838 C347 824 345 804 345 782 Z"
          />
          <g ref={eyeRef} style={{ transformOrigin: '672px 315px' }}>
            <circle cx="672" cy="315" r="107" fill="#FDFDFC" />
            <g ref={pupilRef} style={{ transformOrigin: '612px 348px' }}>
              <circle cx="612" cy="348" r="28" fill="#0E3D18" />
            </g>
          </g>
          <g fill="#FDFDFC">
            <ellipse cx="224" cy="297" rx="12" ry="20" transform="rotate(-8 224 297)" />
            <ellipse cx="320" cy="325" rx="13" ry="19" transform="rotate(-32 320 325)" />
          </g>
        </g>
      </svg>
    </div>
  )
})

export default DinoPeek
