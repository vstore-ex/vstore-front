import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../api/client'
import { getNotifications, markNotificationsRead } from '../api/notifications'
import { useAuth } from '../auth/context'
import { EMPTY_NOTIFICATIONS, NotificationsContext } from './context'
import './Notifications.css'

function websocketUrl() {
  const url = new URL(`${API_BASE_URL}/messages/ws`, window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

function UserNotificationsProvider({ children }) {
  const mounted = useRef(false)
  const seenMessages = useRef(new Set())
  const requestSequence = useRef(0)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)
  const [desktopPermission, setDesktopPermission] = useState(() => {
    if (typeof window === 'undefined' || !window.Notification) return 'unsupported'
    return window.Notification.permission
  })

  const refresh = useCallback(async (signal) => {
    if (!mounted.current) return null
    const requestId = ++requestSequence.current
    setLoading(true)
    setError('')
    try {
      const response = await getNotifications(signal ? { signal } : undefined)
      if (!mounted.current || requestId !== requestSequence.current) return null
      setNotifications(Array.isArray(response?.items) ? response.items : [])
      setUnreadCount(Number(response?.unread_count) || 0)
      return response
    } catch (reason) {
      if (
        mounted.current &&
        !signal?.aborted &&
        requestId === requestSequence.current &&
        reason.status !== 401
      ) {
        setError('Could not load notifications.')
      }
      return null
    } finally {
      if (mounted.current && requestId === requestSequence.current) setLoading(false)
    }
  }, [])

  const markAsRead = useCallback(
    async (notificationIds) => {
      if (!mounted.current) return
      try {
        await markNotificationsRead(notificationIds)
        if (mounted.current) await refresh()
      } catch {
        if (mounted.current) setError('Could not update notifications.')
      }
    },
    [refresh],
  )

  const requestDesktopPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !window.Notification) return 'unsupported'
    const permission = await window.Notification.requestPermission()
    setDesktopPermission(permission)
    return permission
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    mounted.current = true
    let active = true
    let socket = null
    let reconnectTimer = null
    let recoveryController = null
    let reconnectDelay = 1000
    let connectedOnce = false
    seenMessages.current.clear()
    const loadInitial = async () => {
      const requestId = ++requestSequence.current
      try {
        const response = await getNotifications()
        if (!active || requestId !== requestSequence.current) return
        setNotifications(Array.isArray(response?.items) ? response.items : [])
        setUnreadCount(Number(response?.unread_count) || 0)
      } catch (reason) {
        if (active && requestId === requestSequence.current && reason.status !== 401) {
          setError('Could not load notifications.')
        }
      } finally {
        if (active && requestId === requestSequence.current) setLoading(false)
      }
    }
    void loadInitial()

    const connect = () => {
      if (!active || typeof window.WebSocket !== 'function') return
      try {
        const currentSocket = new window.WebSocket(websocketUrl())
        socket = currentSocket
        currentSocket.onopen = () => {
          if (!active) {
            currentSocket.close()
            return
          }
          reconnectDelay = 1000
          if (connectedOnce) void refresh()
          connectedOnce = true
        }

        currentSocket.onmessage = async (event) => {
          let payload
          try {
            payload = JSON.parse(event.data)
          } catch {
            return
          }
          const messageId = payload?.data?.message_id
          if (payload?.type !== 'new_message' || messageId == null) return
          const key = String(messageId)
          if (seenMessages.current.has(key)) return
          seenMessages.current.add(key)

          const response = await refresh()
          if (!active) return
          const notification = response?.items?.find(
            (item) => item.type === 'new_message' && String(item.data?.message_id) === key,
          )
          const incoming = notification || {
            id: key,
            title: 'New message',
            message: 'You received a new private message.',
            data: payload.data,
          }

          if (document.visibilityState === 'hidden') {
            if (window.Notification?.permission === 'granted') {
              const nativeNotification = new window.Notification(incoming.title, {
                body: incoming.message,
                tag: `vstore-message-${key}`,
              })
              nativeNotification.onclick = () => {
                window.focus()
                nativeNotification.close()
              }
            }
            return
          }
          setToast(incoming)
        }

        currentSocket.onclose = () => {
          if (socket === currentSocket) socket = null
          if (active) scheduleReconnect()
        }

        currentSocket.onerror = () => currentSocket.close()
      } catch {
        scheduleReconnect()
      }
    }

    function scheduleReconnect() {
      if (!active || reconnectTimer != null) return
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        recoveryController = new AbortController()
        const controller = recoveryController
        void refresh(controller.signal).finally(() => {
          if (recoveryController === controller) recoveryController = null
          if (active && !controller.signal.aborted) connect()
        })
      }, reconnectDelay)
      reconnectDelay = Math.min(reconnectDelay * 2, 30000)
    }

    connect()
    return () => {
      active = false
      mounted.current = false
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer)
      recoveryController?.abort()
      socket?.close()
    }
  }, [refresh])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 7000)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        error,
        toast,
        desktopPermission,
        refresh,
        markAsRead,
        requestDesktopPermission,
        dismissToast,
      }}
    >
      {children}
      {toast && (
        <aside className="message-toast" role="status" aria-live="polite">
          <div>
            <strong>{toast.title}</strong>
            <p>{toast.message}</p>
          </div>
          <button type="button" aria-label="Dismiss notification" onClick={dismissToast}>
            ×
          </button>
        </aside>
      )}
    </NotificationsContext.Provider>
  )
}

export default function NotificationsProvider({ children }) {
  const { currentUser } = useAuth()
  const userId = currentUser?.id
  if (userId == null) {
    return (
      <NotificationsContext.Provider value={EMPTY_NOTIFICATIONS}>
        {children}
      </NotificationsContext.Provider>
    )
  }
  return <UserNotificationsProvider key={userId}>{children}</UserNotificationsProvider>
}
