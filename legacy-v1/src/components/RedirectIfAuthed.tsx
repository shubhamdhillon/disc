import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Pre-app routes — logged-in users skip straight to /today. */
export default function RedirectIfAuthed() {
  const { session, loading, signupInProgress } = useAuth()

  // Wait for session restore before deciding — never redirect while loading
  if (loading) return null
  if (session && !signupInProgress) return <Navigate to="/today" replace />
  return <Outlet />
}
