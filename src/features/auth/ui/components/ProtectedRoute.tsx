import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Wraps private routes.
 * - While loading the initial session: renders nothing (avoids flash of login page).
 * - No session: redirects to /login, passing current path as `state.from` for returnTo.
 * - Session present: renders the child route via <Outlet />.
 */
export function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="text-sm text-muted-foreground">Cargando…</span>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <Outlet />
}
