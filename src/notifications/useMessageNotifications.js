import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../api/client'
import { isMessageId } from '../api/messages'
import { readStoreLocation } from '../utils/location'

function websocketUrl() {
  const url = new URL(`${API_BASE_URL}/messages/ws`, window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

export default function useMessageNotifications(refresh, enabled, recoverSession = refresh) {
  const seenMessages = useRef(new Set())
  const mounted = useRef(false)
  const listeners = useRef(new Set())
  const [toast, setToast] = useState(null)
  const [messageConnection, setMessageConnection] = useState(() =>
    typeof window.WebSocket === 'function' ? 'connecting' : 'unavailable',
  )
  const subscribeMessages = useCallback((listener) => {
    listeners.current.add(listener)
    return () => listeners.current.delete(listener)
  }, [])
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
    const desktopNotifications = new Set()
    seenMessages.current.clear()
    const publish = (event) => {
      if (active) for (const listener of listeners.current) listener(event)
    }
    const resume = () => {
      if (document.visibilityState !== 'hidden') publish({ type: 'resume' })
    }
    document.addEventListener('visibilitychange', resume)

    const connect = () => {
      if (!active || typeof window.WebSocket !== 'function') return
      try {
        const currentSocket = new window.WebSocket(websocketUrl())
        socket = currentSocket
        currentSocket.onopen = () => {
          if (!active || socket !== currentSocket) {
            currentSocket.close()
            return
          }
          reconnectDelay = 1000
          setMessageConnection('connected')
          publish({ type: 'connected', reconnected: connectedOnce })
          if (connectedOnce)
            void Promise.resolve()
              .then(refresh)
              .catch(() => {})
          connectedOnce = true
        }

        currentSocket.onmessage = async (event) => {
          if (!active || socket !== currentSocket) return
          let payload
          try {
            payload = JSON.parse(event.data)
          } catch {
            return
          }
          const messageId = payload?.data?.message_id
          if (
            payload?.type !== 'new_message' ||
            !isMessageId(messageId) ||
            !isMessageId(payload.data.conversation_id) ||
            !isMessageId(payload.data.sender_id)
          )
            return
          const key = String(messageId)
          if (seenMessages.current.has(key)) return
          seenMessages.current.add(key)
          if (seenMessages.current.size > 500)
            seenMessages.current.delete(seenMessages.current.values().next().value)
          // Deliver immediately: a slow notification-list request must not delay the conversation.
          publish({ type: 'new_message', data: payload.data })

          const response = await Promise.resolve()
            .then(refresh)
            .catch(() => null)
          if (!active) return
          const notification = response?.items?.find(
            (item) => item.type === 'new_message' && String(item.data?.message_id) === key,
          )
          const incoming = notification || {
            id: key,
            type: 'new_message',
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
              desktopNotifications.add(nativeNotification)
              nativeNotification.onclose = () => desktopNotifications.delete(nativeNotification)
              nativeNotification.onclick = () => {
                if (!active) return
                window.location.hash = '#/messages/' + payload.data.conversation_id
                window.focus()
                nativeNotification.close()
              }
            }
            return
          }
          if (readStoreLocation().path === 'messages/' + payload.data.conversation_id) return
          setToast(incoming)
        }

        currentSocket.onclose = () => {
          if (socket !== currentSocket) return
          socket = null
          if (active) {
            setMessageConnection('reconnecting')
            scheduleReconnect()
          }
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
        void Promise.resolve()
          .then(() => recoverSession(controller.signal))
          .then(() => {
            if (active && !controller.signal.aborted) connect()
          })
          .catch((error) => {
            if (!active || controller.signal.aborted) return
            if ([401, 403].includes(error.status)) setMessageConnection('unavailable')
            else scheduleReconnect()
          })
          .finally(() => {
            if (recoveryController === controller) recoveryController = null
          })
      }, reconnectDelay)
      reconnectDelay = Math.min(reconnectDelay * 2, 30000)
    }

    connect()
    return () => {
      active = false
      mounted.current = false
      document.removeEventListener('visibilitychange', resume)
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer)
      recoveryController?.abort()
      socket?.close()
      for (const notification of desktopNotifications) notification.close()
    }
  }, [refresh, recoverSession, enabled])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 7000)
    return () => window.clearTimeout(timer)
  }, [toast])
  return {
    toast: enabled ? toast : null,
    desktopPermission,
    requestDesktopPermission,
    dismissToast,
    subscribeMessages,
    messageConnection: enabled ? messageConnection : 'unavailable',
  }
}
