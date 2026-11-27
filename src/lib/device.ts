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

/** A laptop or desktop: no touch-first pointer, no phone or tablet in the user agent.
 *  The browser itself is the app there, so nothing needs installing. */
export function isDesktop(): boolean {
  const ua = navigator.userAgent
  if (isIOS() || /Android|Mobi/i.test(ua)) return false
  return window.matchMedia('(pointer: fine)').matches
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

/** Home-screen iPhone app, portrait: make the page exactly as tall as the screen.
 *  With the see-through status bar the app owns the whole screen, so screen.height
 *  is the true height, whatever the buggy viewport reports. */
export function fitHomeScreenApp(): void {
  const fit = () => {
    const portrait = window.matchMedia('(orientation: portrait)').matches
    if (isIOS() && isInstalled() && portrait && screen.height > window.innerHeight) {
      document.documentElement.style.height = `${screen.height}px`
    } else {
      document.documentElement.style.removeProperty('height')
    }
  }
  fit()
  addEventListener('resize', fit)
  addEventListener('orientationchange', fit)
}

/** When the on-screen keyboard is open, sets --keyboard-pad to its height so the
 *  screen's button sits just above it. Cleared again when the keyboard closes. */
export function trackViewportHeight(): void {
  const vv = window.visualViewport
  if (!vv) return
  const root = document.documentElement
  const update = () => {
    // Measured against the app's real height, not window.innerHeight, which is
    // short on home-screen iPhones (see fitHomeScreenApp)
    const appHeight = root.getBoundingClientRect().height
    const keyboard = appHeight - vv.height - vv.offsetTop
    if (keyboard > 120) {
      root.style.setProperty('--keyboard-pad', `${Math.round(keyboard) + 12}px`)
      window.scrollTo(0, 0)
    } else {
      root.style.removeProperty('--keyboard-pad')
    }
  }
  update()
  vv.addEventListener('resize', update)
  vv.addEventListener('scroll', update)
}
