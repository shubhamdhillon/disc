import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const DANGER_RED = '#DC2626'

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wider text-gray-400">
      {children}
    </p>
  )
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
      {children}
    </div>
  )
}

function SettingsRow({
  label,
  onClick,
  destructive = false,
  chevron = false,
  badge,
  disabled = false,
}: {
  label: string
  onClick?: () => void
  destructive?: boolean
  chevron?: boolean
  badge?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className="flex h-[52px] w-full items-center justify-between gap-3 px-4 text-left transition-colors active:bg-gray-50 disabled:active:bg-transparent"
    >
      <span
        className="text-[16px] font-medium"
        style={{ color: destructive ? DANGER_RED : '#111827' }}
      >
        {label}
      </span>
      <span className="flex flex-shrink-0 items-center gap-2">
        {badge && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-400">
            {badge}
          </span>
        )}
        {chevron && <ChevronIcon />}
      </span>
    </button>
  )
}

function RowDivider() {
  return <div className="mx-4 h-px bg-gray-100" />
}

function ConfirmDeleteDialog({
  open,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={busy ? undefined : onCancel}
          />
          <motion.div
            className="fixed inset-x-0 top-1/2 z-50 mx-auto w-[calc(100%-48px)] max-w-sm -translate-y-1/2 rounded-2xl bg-white p-5 shadow-xl"
            initial={{ opacity: 0, scale: 0.96, y: '-46%' }}
            animate={{ opacity: 1, scale: 1, y: '-50%' }}
            exit={{ opacity: 0, scale: 0.96, y: '-46%' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-data-title"
          >
            <h2 id="delete-data-title" className="m-0 text-[18px] font-bold text-gray-900">
              Delete all your data?
            </h2>
            <p className="mb-0 mt-2 text-[14px] leading-relaxed text-gray-500">
              This removes all your logged meals, targets, and profile. This can&apos;t be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="flex h-11 flex-1 items-center justify-center rounded-2xl bg-gray-100 text-[15px] font-semibold text-gray-800 transition-opacity disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="flex h-11 flex-1 items-center justify-center rounded-2xl text-[15px] font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ backgroundColor: DANGER_RED }}
              >
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const prefersReduced = useReducedMotion() ?? false
  const { user } = useAuth()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const displayName = localStorage.getItem('disc_name')
  const email = user?.email ?? ''

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
      navigate('/create-account?mode=login')
    } finally {
      setLoggingOut(false)
    }
  }

  const handleDeleteData = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      const uid = (await supabase.auth.getUser()).data.user?.id
      if (!uid) {
        console.error('Delete data: no user id')
        return
      }
      // Full auth-user deletion requires a server-side admin call
      // (edge function with service_role) — this deletes the user's DATA and signs
      // them out; wiring true account deletion is a later step.
      await supabase.from('meals').delete().eq('user_id', uid)
      await supabase.from('targets').delete().eq('user_id', uid)
      await supabase.from('profiles').delete().eq('id', uid)
      await supabase.auth.signOut()
      navigate('/splash')
    } catch (err) {
      console.error('Delete data failed:', err)
      setDeleting(false)
      setConfirmOpen(false)
    }
  }

  return (
    <motion.div
      className="flex h-dvh w-full flex-col bg-gray-50"
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 border-b border-gray-100 bg-white"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        <div className="flex h-12 items-center gap-2 px-3">
          <button
            type="button"
            aria-label="Back"
            onClick={() => navigate('/today')}
            className="flex h-10 w-10 items-center justify-center rounded-full"
          >
            <BackIcon />
          </button>
          <h1 className="m-0 text-[17px] font-semibold text-gray-900">Settings</h1>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto px-5 pt-6"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 32px)' }}
      >
        {/* Profile */}
        <div className="mb-8 flex items-center gap-3.5">
          <img
            src="/avatar.png"
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 flex-shrink-0 rounded-full object-cover"
            style={{ border: '1px solid rgba(0,0,0,0.06)' }}
          />
          <div className="min-w-0">
            {displayName && (
              <p className="m-0 truncate text-[17px] font-semibold text-gray-900">{displayName}</p>
            )}
            <p className={`m-0 truncate text-[14px] text-gray-500 ${displayName ? 'mt-0.5' : 'text-[16px] font-medium text-gray-800'}`}>
              {email || 'Signed in'}
            </p>
          </div>
        </div>

        {/* Account */}
        <section className="mb-6">
          <SectionLabel>Account</SectionLabel>
          <SettingsGroup>
            <SettingsRow label="Change goals" chevron badge="Coming soon" />
            <RowDivider />
            <SettingsRow label="Dietary preferences" chevron badge="Coming soon" />
          </SettingsGroup>
        </section>

        {/* Session */}
        <section className="mb-6">
          <SectionLabel>Session</SectionLabel>
          <SettingsGroup>
            <SettingsRow
              label={loggingOut ? 'Logging out…' : 'Log out'}
              onClick={handleLogout}
              disabled={loggingOut}
            />
          </SettingsGroup>
        </section>

        {/* Danger zone */}
        <section>
          <SectionLabel>Danger zone</SectionLabel>
          <SettingsGroup>
            <SettingsRow
              label="Delete my data"
              destructive
              onClick={() => setConfirmOpen(true)}
            />
          </SettingsGroup>
        </section>
      </div>

      <ConfirmDeleteDialog
        open={confirmOpen}
        busy={deleting}
        onCancel={() => { if (!deleting) setConfirmOpen(false) }}
        onConfirm={handleDeleteData}
      />
    </motion.div>
  )
}
