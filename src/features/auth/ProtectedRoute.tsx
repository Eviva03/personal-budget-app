import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export function ProtectedRoute() {
  const { configured, loading, user } = useAuth()
  const location = useLocation()

  if (!configured) return <Navigate to="/profil" replace />
  if (loading) return <div className="app-loading" role="status"><span className="spinner" aria-hidden="true" />Chargement...</div>
  return user ? <Outlet /> : <Navigate to="/profil" replace state={{ from: location }} />
}