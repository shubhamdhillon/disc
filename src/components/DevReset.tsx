// Dev-only floating UI: "reset flow" button + collapsible estimate-error log.
//
// Vite replaces import.meta.env.DEV with false at build time, so the outer
// guard makes this dead code. The inner component (DevResetInner) is never
// referenced outside this module, so it is tree-shaken from production bundles.

import { useState } from 'react'
import { type EstimateLogEntry, getEstimateLog, clearEstimateLog } from '../lib/estimateLog'

// ── Helpers ───────────────────────────────────────────────────────────────────

const CODE_COLOR: Record<string, string> = {
  TIMEOUT:             '#f59e0b',
  RATE_LIMITED:        '#f97316',
  AUTH_FAILURE:        '#ef4444',
  NO_API_KEY:          '#ef4444',
  NETWORK_ERROR:       '#ef4444',
  MODEL_NOT_AVAILABLE: '#a855f7',
  SAFETY_BLOCK:        '#6b7280',
  EMPTY_RESPONSE:      '#6b7280',
  PARSE_FAILED:        '#60a5fa',
  API_ERROR:           '#f97316',
}

function relTime(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60)   return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

// Shared button style — matches the original DevReset look
const btnStyle: React.CSSProperties = {
  background:           'rgba(0,0,0,0.55)',
  backdropFilter:       'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  color:                '#fff',
  border:               '1px solid rgba(255,255,255,0.18)',
  borderRadius:         '99px',
  padding:              '5px 13px',
  fontSize:             '11px',
  fontFamily:           'monospace',
  letterSpacing:        '0.02em',
  cursor:               'pointer',
  lineHeight:           '1.6',
  userSelect:           'none',
}

const monoSm: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize:   '10px',
  lineHeight: '1.55',
}

// ── Inner component (hooks are safe here — always rendered in DEV) ─────────────

function DevResetInner() {
  const [logOpen, setLogOpen]   = useState(false)
  const [entries, setEntries]   = useState<readonly EstimateLogEntry[]>([])

  const refresh = () => setEntries(getEstimateLog())

  const handleToggleLog = () => {
    const opening = !logOpen
    if (opening) setEntries(getEstimateLog())   // refresh snapshot on open
    setLogOpen(opening)
  }

  const handleReset = () => {
    sessionStorage.removeItem('disc_splash')
    localStorage.removeItem('disc_intro_seen')
    localStorage.removeItem('disc_targets')
    localStorage.removeItem('disc_name')
    localStorage.removeItem('disc_meals')
    clearEstimateLog()
    window.location.replace('/')
  }

  return (
    <div style={{
      position:       'fixed',
      bottom:         '20px',
      right:          '16px',
      zIndex:         9999,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'flex-end',
      gap:            '6px',
    }}>

      {/* ── Error log panel ── */}
      {logOpen && (
        <div style={{
          maxHeight:            '360px',
          width:                'min(318px, calc(100vw - 32px))',
          maxWidth:             '100%',
          overflowY:            'auto',
          overflowX:            'hidden',
          background:           'rgba(10,10,12,0.93)',
          backdropFilter:       'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border:               '1px solid rgba(255,255,255,0.09)',
          borderRadius:         '14px',
          padding:              '10px 12px',
          boxSizing:            'border-box',
        }}>

          {/* Panel header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ ...monoSm, color: '#666', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              estimate errors&nbsp;({entries.length})
            </span>
            <button
              onClick={refresh}
              title="Refresh"
              style={{ ...monoSm, color: '#555', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '13px' }}
            >
              ↻
            </button>
          </div>

          {/* Empty state */}
          {entries.length === 0 && (
            <p style={{ ...monoSm, color: '#3a3a3a', textAlign: 'center', margin: '14px 0' }}>
              no errors yet
            </p>
          )}

          {/* Entries — newest first */}
          {[...entries].reverse().map((e, i) => (
            <div
              key={i}
              style={{
                borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                padding: '6px 0',
              }}
            >
              {/* Code + relative time */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ ...monoSm, fontWeight: 'bold', color: CODE_COLOR[e.code] ?? '#fff' }}>
                  {e.code}
                </span>
                <span style={{ ...monoSm, color: '#444' }}>
                  {relTime(e.ts)}
                </span>
              </div>

              {/* Model · http status · elapsed */}
              <div style={{ ...monoSm, color: '#555', marginTop: '1px' }}>
                {e.model}
                {e.httpStatus !== null ? ` · http\u00a0${e.httpStatus}` : ''}
                {` · ${e.elapsedMs}\u202fms`}
              </div>

              {/* Detail snippet */}
              <div style={{ ...monoSm, color: '#777', marginTop: '2px', wordBreak: 'break-word' }}>
                {e.detail}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Button row ── */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={handleToggleLog} style={btnStyle} title="Toggle error log">
          {logOpen ? '✕ log' : '⚠ log'}
        </button>
        <button onClick={handleReset} style={btnStyle} title="Reset all first-launch flags (dev only)">
          ↺ reset flow
        </button>
      </div>

    </div>
  )
}

// ── Guard wrapper — this is the only export ────────────────────────────────────
// The `if (!DEV) return null` is evaluated at build time.  Rollup sees a constant
// false, removes the `return <DevResetInner />` branch, and since DevResetInner
// is then unreferenced it is dropped from the bundle entirely.

export default function DevReset() {
  if (!import.meta.env.DEV) return null
  return <DevResetInner />
}
