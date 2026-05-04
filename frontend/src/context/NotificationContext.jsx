import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'

const NotificationContext = createContext(null)

let idCounter = 0
const DEFAULT_DURATION = 4000

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle
}

function NotifItem({ n, onRemove }) {
  const [exiting, setExiting] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setExiting(true)
      setTimeout(() => onRemove(n.id), 250)
    }, n.duration || DEFAULT_DURATION)

    return () => clearTimeout(timerRef.current)
  }, [n.id, n.duration, onRemove])

  const handleClose = () => {
    clearTimeout(timerRef.current)
    setExiting(true)
    setTimeout(() => onRemove(n.id), 250)
  }

  const Icon = ICONS[n.type] || Info

  return (
    <div className={`notif notif-${n.type} ${exiting ? 'notif-exit' : ''}`} role="alert">
      <div className="notif-icon"><Icon size={20} /></div>
      <div className="notif-msg">{n.message}</div>
      <button className="notif-close" onClick={handleClose} aria-label="Yopish">
        <X size={14} />
      </button>
      <div className="notif-progress" style={{ animationDuration: `${(n.duration || DEFAULT_DURATION)}ms` }} />
    </div>
  )
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([])

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const addNotification = useCallback((message, type = 'info', duration = DEFAULT_DURATION) => {
    const id = ++idCounter + '-' + Date.now()
    setNotifications(prev => [...prev, { id, message, type, duration }])
    return id
  }, [])

  return (
    <NotificationContext.Provider value={{ addNotification, removeNotification }}>
      {children}
      <div className="notif-wrap" aria-live="polite" aria-atomic="false">
        {notifications.map(n => (
          <NotifItem key={n.id} n={n} onRemove={removeNotification} />
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

export const useNotification = () => useContext(NotificationContext)
