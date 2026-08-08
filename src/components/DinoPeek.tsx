import { forwardRef, useImperativeHandle, useRef } from 'react'

export interface DinoPeekHandle {
  play: () => void
  cancel: () => void
  /** Spin reaction: rise + look while disc holds, then tumble away. */
  reactToSpin: () => void
}

interface DinoPeekProps {
  size?: number
  /** Called when a peek starts (number should fade out). */
  onPeekStart?: () => void
  /** Called when the number should fade back in. */
  onPeekEnd?: () => void
}

const DinoPeek = forwardRef<DinoPeekHandle, DinoPeekProps>(function DinoPeek(
  { size = 70, onPeekStart, onPeekEnd },
  ref,
) {
  const shakeRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const tiltRef = useRef<SVGGElement>(null)
  const squashRef = useRef<SVGGElement>(null)
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
    if (shakeRef.current) shakeRef.current.style.transform = 'rotate(0deg)'
    if (rootRef.current) rootRef.current.style.transform = 'translateY(105%)'
    if (tiltRef.current) tiltRef.current.style.transform = 'rotate(0deg)'
    if (squashRef.current) squashRef.current.style.transform = 'scale(1, 1)'
    if (eyeRef.current) eyeRef.current.style.transform = 'scale(1)'
    if (pupilRef.current) pupilRef.current.style.transform = 'translate(0px, 0px) scale(1)'
  }

  useImperativeHandle(ref, () => ({
    play() {
      clear()
      resetTransforms()
      onPeekStart?.()

      const root = rootRef.current
      const tilt = tiltRef.current
      const squash = squashRef.current
      const eye = eyeRef.current
      const pupil = pupilRef.current
      if (!root || !tilt || !squash || !eye || !pupil) return

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

      track(root.animate(
        [
          { transform: 'translateY(105%)' },
          { transform: 'translateY(-7%)', offset: 0.68, easing: 'cubic-bezier(.34,1.5,.5,1)' },
          { transform: 'translateY(0%)' },
        ],
        { duration: 620, fill: 'forwards', easing: 'cubic-bezier(.2,.8,.3,1)' },
      ))

      at(600, () => {
        track(squash.animate(
          [
            { transform: 'scale(1, 1)' },
            { transform: 'scale(1.09, 0.9)' },
            { transform: 'scale(0.97, 1.03)' },
            { transform: 'scale(1, 1)' },
          ],
          { duration: 420, easing: 'ease-out' },
        ))
      })

      at(760, () => {
        track(tilt.animate(
          [
            { transform: 'rotate(0deg)' },
            { transform: 'rotate(-7deg)' },
          ],
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

      at(1420, () => {
        track(pupil.animate(
          [
            { transform: 'translate(-26px, -14px) scale(1)' },
            { transform: 'translate(30px, 6px) scale(1)' },
          ],
          { duration: 300, fill: 'forwards', easing: 'ease-out' },
        ))
      })

      at(1500, () => {
        track(tilt.animate(
          [
            { transform: 'rotate(-7deg)' },
            { transform: 'rotate(5deg)' },
          ],
          { duration: 380, fill: 'forwards' },
        ))
      })

      at(1900, blink)

      at(2150, () => {
        track(pupil.animate(
          [
            { transform: 'translate(30px, 6px) scale(1)' },
            { transform: 'translate(0px, 0px) scale(1)' },
          ],
          { duration: 240, fill: 'forwards' },
        ))
        track(tilt.animate(
          [
            { transform: 'rotate(5deg)' },
            { transform: 'rotate(0deg)' },
          ],
          { duration: 280, fill: 'forwards' },
        ))
      })

      at(2450, () => {
        track(squash.animate(
          [
            { transform: 'scale(1, 1)' },
            { transform: 'scale(0.94, 1.08)' },
          ],
          { duration: 140, easing: 'ease-in', fill: 'forwards' },
        ))
        track(root.animate(
          [
            { transform: 'translateY(0%)' },
            { transform: 'translateY(105%)' },
          ],
          { duration: 360, fill: 'forwards', easing: 'cubic-bezier(.6,0,.9,.4)' },
        ))
      })

      at(2750, () => {
        onPeekEnd?.()
      })
    },

    cancel() {
      clear()
      resetTransforms()
      onPeekEnd?.()
    },

    reactToSpin() {
      // Cancel idle peek so it does not fight the spin reaction
      clear()
      resetTransforms()
      onPeekStart?.()

      const shake = shakeRef.current
      const root = rootRef.current
      const tilt = tiltRef.current
      const eye = eyeRef.current
      const pupil = pupilRef.current
      if (!shake || !root || !tilt || !eye || !pupil) return

      const track = (a: Animation | undefined) => {
        if (a) animsRef.current.push(a)
      }
      const at = (ms: number, fn: () => void) => {
        timersRef.current.push(setTimeout(fn, ms))
      }

      // t=0 — rise while disc holds
      track(root.animate(
        [
          { transform: 'translateY(105%)' },
          { transform: 'translateY(-10%)', offset: 0.72, easing: 'cubic-bezier(.2,1.6,.4,1)' },
          { transform: 'translateY(0%)' },
        ],
        { duration: 260, fill: 'forwards', easing: 'cubic-bezier(.2,1.6,.4,1)' },
      ))

      // t=0 — pupil shrinks, eye grows, tilt right
      track(pupil.animate(
        [
          { transform: 'translate(0px, 0px) scale(1)' },
          { transform: 'translate(0px, 0px) scale(0.45)' },
        ],
        { duration: 200, fill: 'forwards', easing: 'ease-out' },
      ))
      track(eye.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.16)' },
        ],
        { duration: 200, fill: 'forwards', easing: 'ease-out' },
      ))
      track(tilt.animate(
        [
          { transform: 'rotate(0deg)' },
          { transform: 'rotate(11deg)' },
        ],
        { duration: 250, fill: 'forwards', easing: 'ease-out' },
      ))

      // t=420 — tilt the other way
      at(420, () => {
        track(tilt.animate(
          [
            { transform: 'rotate(11deg)' },
            { transform: 'rotate(-6deg)' },
          ],
          { duration: 420, fill: 'forwards', easing: 'cubic-bezier(.3,.9,.3,1)' },
        ))
      })

      // t=500 HOLD — shake while chamber releases
      at(500, () => {
        track(shake.animate(
          [
            { transform: 'rotate(0deg)' },
            { transform: 'rotate(-15deg)' },
            { transform: 'rotate(12deg)' },
            { transform: 'rotate(-9deg)' },
            { transform: 'rotate(6deg)' },
            { transform: 'rotate(0deg)' },
          ],
          { duration: 400, easing: 'linear' },
        ))
      })

      // t=880 — tumble away
      at(880, () => {
        track(root.animate(
          [
            { transform: 'translateY(0%) rotate(0deg) scale(1)' },
            { transform: 'translateY(135%) rotate(250deg) scale(0.8)' },
          ],
          { duration: 360, fill: 'forwards', easing: 'cubic-bezier(.5,0,.9,.4)' },
        ))
      })
    },
  }))

  return (
    <div
      ref={shakeRef}
      style={{
        width: size,
        height: size,
        transformOrigin: '50% 100%',
        willChange: 'transform',
      }}
    >
      <div
        ref={rootRef}
        style={{
          width: size,
          height: size,
          transform: 'translateY(105%)',
          willChange: 'transform',
        }}
      >
        <svg
          viewBox="160 30 870 880"
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          aria-hidden="true"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <g ref={tiltRef} style={{ transformOrigin: '600px 830px' }}>
            <g ref={squashRef} style={{ transformOrigin: '600px 830px' }}>
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
          </g>
          <rect x="205" y="803" width="810" height="27" fill="#1C7C2E" />
        </svg>
      </div>
    </div>
  )
})

export default DinoPeek
