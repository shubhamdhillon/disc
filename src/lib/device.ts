/** True when Disc was opened from the home screen, not in a browser tab.
 *  Adding ?installed=1 to the link pretends it is, for checking screens in a browser. */
export function isInstalled(): boolean {
  if (new URLSearchParams(location.search).has('installed')) return true
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

/** iPhone or iPad (newer iPads report themselves as a Mac with touch). */
export function isIOS(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

/** iPhone, but in Chrome, Firefox, Edge or an app's built-in browser (Instagram, LinkedIn…).
 *  Adding to the home screen is only dependable from Safari, so these get sent there. */
export function isIOSNotSafari(): boolean {
  return isIOS() && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|Instagram|FBAN|FBAV|LinkedInApp|Line\//.test(navigator.userAgent)
}

/* Chrome and Android offer their own install pop-up. It arrives once,
   early, so it is caught here at load and kept for when the button is tapped. */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let installEvent: InstallEvent | null = null
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()
  installEvent = e as InstallEvent
})

export function canPromptInstall(): boolean {
  return installEvent !== null
}

/** Shows the browser's own install pop-up. True if the person said yes. */
export async function promptInstall(): Promise<boolean> {
  if (!installEvent) return false
  const ev = installEvent
  installEvent = null
  await ev.prompt()
  const { outcome } = await ev.userChoice
  return outcome === 'accepted'
}

/** When the on-screen keyboard is open, sets --keyboard-pad to its height so the
 *  screen's button sits just above it. Cleared again when the keyboard closes. */
export function trackViewportHeight(): void {
  const vv = window.visualViewport
  if (!vv) return
  const root = document.documentElement
  const update = () => {
    const keyboard = window.innerHeight - vv.height - vv.offsetTop
    if (keyboard > 120) {
      root.style.setProperty('--keyboard-pad', `${Math.round(keyboard) + 12}px`)
      // iPhone nudges the page up when a field is focused; keep it still
      window.scrollTo(0, 0)
    } else {
      root.style.removeProperty('--keyboard-pad')
    }
  }
  update()
  vv.addEventListener('resize', update)
  vv.addEventListener('scroll', update)
}
