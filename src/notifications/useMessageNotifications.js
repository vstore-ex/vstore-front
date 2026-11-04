import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../api/client'

function websocketUrl() {
  const url = new URL(`${API_BASE_URL}/messages/ws`, window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

export default function useMessageNotifications(refresh, enabled, recoverSession = refresh) {
  const seenMessages = useRef(new Set())
  const mounted = useRef(false)
  const [toast, setToast] = useState(null)
  const [desktopPermission, setDesktopPermission] = useState(
    () => window.Notification?.permission || 'unsupported',
  )
  const requestDesktopPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !window.Notification) return 'unsupported'
    const permission = await window.Notification.requestPermission()
    if (mounted.current) setDesktopPermission(permission)
    return permission
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    if (!enabled) return
    mounted.current = true
    let active = true
    let socket = null
    let reconnectTimer = null
    let recoveryController = null
    let reconnectDelay = 1000
    let connectedOnce = false
    seenMessages.current.clear()

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
        void recoverSession(controller.signal)
          .catch(() => {})
          .finally(() => {
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
  }, [refresh, recoverSession, enabled])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 7000)
    return () => window.clearTimeout(timer)
  }, [toast])
  return { toast, desktopPermission, requestDesktopPermission, dismissToast }
}
