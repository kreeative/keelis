import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '@/store/session'
import { PageFallback } from './PageFallback'

export function RequireAuth() {
  const { status } = useSession()
  const location = useLocation()
  if (status === 'loading') return <PageFallback />
  if (status === 'anonymous') return <Navigate to="/bienvenue" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function RequireAnonymous() {
  const { status } = useSession()
  if (status === 'loading') return <PageFallback />
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}
