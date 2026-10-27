import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export function ProtectedRoute() {
  const { configured, loading, user } = useAuth()
  const location = useLocation()

  if (!configured) return <Navigate to="/profil" replace />
  if (loading) return <p>Chargement...</p>
  return user ? <Outlet /> : <Navigate to="/profil" replace state={{ from: location }} />
}