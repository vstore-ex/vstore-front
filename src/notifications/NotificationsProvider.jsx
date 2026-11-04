import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/context'
import {
  deleteNotification,
  getNotifications,
  getUnreadCount,
  markNotificationsRead,
  notificationError,
  notificationDestination,
} from '../api/notifications'
import { NotificationsContext } from './context'
import useMessageNotifications from './useMessageNotifications'
import './Notifications.css'

const initialQuery = { limit: 20, offset: 0, unread_only: false }

function NotificationSession({ owner, children }) {
  const [count, setCount] = useState(null)
  const [countError, setCountError] = useState('')
  const [list, setList] = useState({
    data: null,
    query: initialQuery,
    retryQuery: initialQuery,
    loading: false,
    error: '',
  })
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')
  const active = useRef(false)
  const countRequest = useRef(null)
  const listRequest = useRef(null)
  const mutation = useRef(null)
  const locked = useRef(false)
  const queryRef = useRef(initialQuery)

  // Layout cleanup also prevents late results from a previous account being committed.
  useLayoutEffect(() => {
    active.current = true
    return () => {
      active.current = false
      countRequest.current?.abort()
      listRequest.current?.abort()
      mutation.current?.abort()
    }
  }, [])

  const load = useCallback(
    async function loadPage(query = initialQuery, signal, internal = false) {
      if (owner == null || !active.current || (locked.current && !internal)) return false
      listRequest.current?.abort()
      countRequest.current?.abort()
      const controller = new AbortController()
      const requestSignal = signal
        ? AbortSignal.any([signal, controller.signal])
        : controller.signal
      listRequest.current = controller
      queryRef.current = query
      if (!internal) {
        setActionError('')
        setMessage('')
      }
      setList((previous) => ({ ...previous, loading: true, error: '', retryQuery: query }))
      try {
        const data = await getNotifications(query, requestSignal)
        if (requestSignal.aborted || !active.current) return false
        if (data.items.some((item) => item.user_id !== owner))
          throw new Error('Could not verify notification ownership. Please sign in again.')
        // total includes read items even with unread_only=true in the backend contract.
        const total = query.unread_only ? data.unread_count : data.total
        if (query.offset > 0 && query.offset >= total)
          return await loadPage(
            { ...query, offset: Math.max(0, Math.ceil(total / query.limit) - 1) * query.limit },
            signal,
            internal,
          )
        setCount(data.unread_count)
        setCountError('')
        setList({ data, query, retryQuery: query, loading: false, error: '' })
        return data
      } catch (error) {
        if (requestSignal.aborted || !active.current) return false
        const privateError = [401, 403].includes(error.status)
        if (privateError) setCount(null)
        setCountError(notificationError(error))
        setList((previous) => ({
          ...previous,
          data: privateError ? null : previous.data,
          loading: false,
          error: notificationError(error),
        }))
        return false
      } finally {
        if (listRequest.current === controller) {
          listRequest.current = null
          if (requestSignal.aborted && active.current)
            setList((previous) => ({ ...previous, loading: false }))
        }
      }
    },
    [owner],
  )

  const refresh = useCallback(() => load(queryRef.current), [load])
  const recoverSession = useCallback((signal) => getUnreadCount(signal), [])
  const messages = useMessageNotifications(refresh, owner != null, recoverSession)

  useEffect(() => {
    // Opening the page already loads an authoritative count with the list.
    if (owner == null || listRequest.current) return
    const controller = new AbortController()
    countRequest.current = controller
    getUnreadCount(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted && active.current) setCount(value)
      })
      .catch((error) => {
        if (!controller.signal.aborted && active.current) setCountError(notificationError(error))
      })
    return () => controller.abort()
  }, [owner])

  async function mutate(kind, value) {
    if (
      owner == null ||
      !active.current ||
      locked.current ||
      list.loading ||
      !list.data ||
      list.error
    )
      return false
    locked.current = true
    setBusy(true)
    setActionError('')
    setMessage('')
    countRequest.current?.abort()
    listRequest.current?.abort()
    const controller = new AbortController()
    mutation.current = controller
    try {
      if (kind === 'delete') await deleteNotification(value, controller.signal)
      else await markNotificationsRead(value, controller.signal)
      if (controller.signal.aborted || !active.current) return false
      setCountError('Refresh notifications to update the unread count.')
      const refreshed = await load(list.query, controller.signal, true)
      if (controller.signal.aborted || !active.current) return false
      setMessage(
        refreshed
          ? kind === 'delete'
            ? 'Notification deleted.'
            : 'Read status updated.'
          : 'Update completed. Refresh to see the latest notifications.',
      )
      return true
    } catch (error) {
      if (controller.signal.aborted || !active.current) return false
      setActionError(notificationError(error))
      if ([401, 403].includes(error.status)) {
        setCount(null)
        setCountError(notificationError(error))
        setList((previous) => ({ ...previous, data: null, error: notificationError(error) }))
      }
      return false
    } finally {
      locked.current = false
      if (active.current && !controller.signal.aborted) setBusy(false)
    }
  }

  return (
    <NotificationsContext.Provider
      value={{
        countError,
        list,
        load,
        busy,
        actionError,
        message,
        remove: (id) => mutate('delete', id),
        notifications: list.data?.items || [],
        unreadCount: count,
        loading: list.loading,
        error: list.error || actionError,
        refresh,
        markAsRead: (ids = null) => mutate('read', ids),
        ...messages,
      }}
    >
      {children}
      {messages.toast && (
        <aside className="message-toast" role="status" aria-live="polite">
          <div>
            <strong>{messages.toast.title}</strong>
            <p>{messages.toast.message}</p>
            {notificationDestination(messages.toast) && (
              <a
                href={notificationDestination(messages.toast).href}
                onClick={messages.dismissToast}
              >
                Open conversation
              </a>
            )}
          </div>
          <button type="button" aria-label="Dismiss notification" onClick={messages.dismissToast}>
            ×
          </button>
        </aside>
      )}
    </NotificationsContext.Provider>
  )
}

export default function NotificationsProvider({ children }) {
  const { currentUser, isAuthenticated } = useAuth()
  const owner = isAuthenticated ? currentUser?.id : null
  return (
    <NotificationSession key={owner ?? 'guest'} owner={owner}>
      {children}
    </NotificationSession>
  )
}
