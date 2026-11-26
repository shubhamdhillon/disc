import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Protects app routes — redirects to /splash when there is no session. */
export default function RequireAuth() {
  const { session, loading } = useAuth()

  // Wait for session restore before deciding — never redirect while loading
  if (loading) return null
  if (!session) return <Navigate to="/splash" replace />
  return <Outlet />
}
