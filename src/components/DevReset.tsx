// Dev-only floating button to reset all "have you seen this screen" flags.
// Vite removes this component entirely from production builds because
// import.meta.env.DEV is false at build time — dead code elimination strips it.

export default function DevReset() {
  if (!import.meta.env.DEV) return null

  const handleReset = () => {
    // Session flags
    sessionStorage.removeItem('disc_splash')

    // All localStorage keys written by this app
    localStorage.removeItem('disc_intro_seen')
    localStorage.removeItem('disc_targets')
    localStorage.removeItem('disc_name')
    localStorage.removeItem('disc_meals')

    window.location.replace('/')
  }

  return (
    <button
      onClick={handleReset}
      title="Reset all first-launch flags (dev only)"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '16px',
        zIndex: 9999,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: '99px',
        padding: '5px 13px',
        fontSize: '11px',
        fontFamily: 'monospace',
        letterSpacing: '0.02em',
        cursor: 'pointer',
        lineHeight: '1.6',
        userSelect: 'none',
      }}
    >
      ↺ reset flow
    </button>
  )
}
