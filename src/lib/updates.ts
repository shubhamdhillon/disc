import { registerSW } from 'virtual:pwa-register'

/*
  Keeps the home-screen app on the newest version.
  The app saves itself on the phone so it opens fast and offline. Without this,
  it kept showing the old saved copy after an update. Now it checks for a new
  version when it opens and whenever it's brought back to the front, and
  reloads itself once the new version is in. Setup answers live on the phone,
  so a reload mid-setup loses nothing.
*/
export function keepUpToDate(): void {
  if (!('serviceWorker' in navigator)) return
  const update = registerSW({
    immediate: true,
    onNeedRefresh() { void update(true) },
    onRegisteredSW(_url, reg) {
      if (!reg) return
      const check = () => { if (navigator.onLine) void reg.update() }
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
      setInterval(check, 5 * 60 * 1000)
    },
  })
}
