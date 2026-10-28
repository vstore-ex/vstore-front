import { useEffect, useId, useRef, useState } from 'react'
import { useNotifications } from './context'
import './Notifications.css'

function formatCreatedAt(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export default function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    desktopPermission,
    refresh,
    markAsRead,
    requestDesktopPermission,
  } = useNotifications()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const root = useRef(null)
  const toggle = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const closeOutside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  function togglePanel() {
    const nextOpen = !open
    setOpen(nextOpen)
    if (nextOpen) void refresh()
  }

  function handleKeyDown(event) {
    if (event.key !== 'Escape' || !open) return
    event.preventDefault()
    event.stopPropagation()
    setOpen(false)
    toggle.current?.focus()
  }

  return (
    <div className="notification-center" ref={root} onKeyDown={handleKeyDown}>
      <button
        ref={toggle}
        className="icon-button notification-button"
        type="button"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={togglePanel}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {unreadCount > 0 && (
          <span className="cart-count notification-count" aria-live="polite">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <section
          className="notification-panel"
          id={panelId}
          role="dialog"
          aria-label="Notifications"
        >
          <header className="notification-panel__header">
            <h2>Notifications</h2>
            <button
              type="button"
              className="notification-text-button"
              onClick={() => void refresh()}
            >
              Refresh
            </button>
          </header>
          {unreadCount > 0 && (
            <button
              type="button"
              className="notification-text-button notification-mark-all"
              onClick={() => void markAsRead()}
            >
              Mark all as read
            </button>
          )}
          {desktopPermission === 'default' && (
            <button
              type="button"
              className="notification-desktop-toggle"
              onClick={() => void requestDesktopPermission()}
            >
              Enable desktop notifications
            </button>
          )}
          {desktopPermission === 'denied' && (
            <p className="notification-hint">
              Desktop notifications are blocked in browser settings.
            </p>
          )}
          {error && (
            <div className="notification-error" role="alert">
              <p>{error}</p>
              <button type="button" onClick={() => void refresh()}>
                Retry
              </button>
            </div>
          )}
          {loading && !notifications.length ? (
            <p className="notification-empty" role="status">
              Loading notifications...
            </p>
          ) : notifications.length ? (
            <ul className="notification-list">
              {notifications.map((notification) => (
                <li
                  className={`notification-item${notification.is_read ? '' : ' notification-item--unread'}`}
                  key={notification.id}
                >
                  <article>
                    <div className="notification-item__copy">
                      <strong>{notification.title}</strong>
                      <p>{notification.message}</p>
                      <time dateTime={notification.created_at}>
                        {formatCreatedAt(notification.created_at)}
                      </time>
                    </div>
                    {!notification.is_read && (
                      <button
                        type="button"
                        className="notification-read-button"
                        aria-label={`Mark ${notification.title} as read`}
                        onClick={() => void markAsRead([notification.id])}
                      >
                        Mark read
                      </button>
                    )}
                  </article>
                </li>
              ))}
            </ul>
          ) : (
            !error && <p className="notification-empty">You're all caught up.</p>
          )}
        </section>
      )}
    </div>
  )
}
