import { Navigate, useLocation } from 'react-router-dom'
import { getToken, getUser } from './api'

export default function RequireAuth({ role, children }) {
  const location = useLocation()
  const token = getToken()
  const user = getUser()

  if (!token || !user) {
    return <Navigate to="/register" state={{ from: location }} replace />
  }

  if (role) {
    const allowed = Array.isArray(role) ? role : [role]
    if (!allowed.includes(user.role)) {
      return <Navigate to="/" replace />
    }
  }

  return children
}
