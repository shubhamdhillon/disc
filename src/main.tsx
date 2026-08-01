import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ─── Dev flag diagnostics ─────────────────────────────────────────────────────
// Logs current state of all "have you seen this" flags so you can tell at a
// glance why a screen was skipped.  Also supports /?reset as a URL shortcut
// (the floating "↺ reset flow" button does the same thing with one tap).
if (import.meta.env.DEV) {
  // URL-based reset (alternative to the on-screen button)
  if (new URLSearchParams(window.location.search).has('reset')) {
    sessionStorage.removeItem('disc_splash')
    localStorage.removeItem('disc_intro_seen')
    window.history.replaceState({}, '', window.location.pathname)
  }

  const splashSeen  = !!sessionStorage.getItem('disc_splash')
  const introSeen   = !!localStorage.getItem('disc_intro_seen')
  const nextScreen  = !splashSeen ? 'Splash (full animation)' : 'Splash (quick fade)'
  const introStatus = introSeen
    ? '⚠️  disc_intro_seen is SET → Intro will be skipped. Tap "↺ reset flow" to clear.'
    : '✓  disc_intro_seen is clear → Intro will show'

  console.groupCollapsed('%c[Disc] App started', 'color:#1C7C2E;font-weight:bold')
  console.log('Splash mode :', nextScreen)
  console.log('Intro flag  :', introStatus)
  console.groupEnd()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
