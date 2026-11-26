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

/** Keeps --app-height equal to the visible area, which shrinks when the keyboard opens. */
export function trackViewportHeight(): void {
  const vv = window.visualViewport
  const set = () => document.documentElement.style.setProperty('--app-height', `${vv ? vv.height : innerHeight}px`)
  set()
  vv?.addEventListener('resize', set)
  addEventListener('resize', set)
}
