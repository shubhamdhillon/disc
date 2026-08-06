import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ─── Dev flag diagnostics ─────────────────────────────────────────────────────
// Logs current state of all "have you seen this" flags so you can tell at a
// glance why a screen was skipped.  Also supports /?reset as a URL shortcut
// (the floating "↺ reset flow" button does the same thing with one tap).
if (import.meta.env.DEV) {
  // Surface uncaught errors on real phones where DevTools isn't available
  window.addEventListener('error', e => {
    alert('JS Error: ' + e.message + '\n' + (e.filename || '') + ':' + (e.lineno || ''))
  })
  window.addEventListener('unhandledrejection', e => {
    alert('Promise rejection: ' + ((e.reason as Error)?.message || e.reason))
  })

  // URL-based reset (alternative to the on-screen button)
  if (new URLSearchParams(window.location.search).has('reset')) {
    sessionStorage.removeItem('disc_splash')
    localStorage.removeItem('disc_intro_seen')
    localStorage.removeItem('disc_targets')
    localStorage.removeItem('disc_name')
    localStorage.removeItem('disc_meals')
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
